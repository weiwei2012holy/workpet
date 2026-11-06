/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 活动提醒与专注状态机插件服务，负责物理活动监控、工作倒计时、休息状态管理、午休/下班长时间离座排除及今日专注走势数据统计
 **/

package activity

import (
	"fmt"
	"log"
	"sync"
	"time"

	"workpet/pkg/config"
	"workpet/pkg/idle"
	"workpet/pkg/storage"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ReminderState 表示前端同步的状态数据模型
type ReminderState struct {
	IntervalMinutes         int  `json:"intervalMinutes"`         // 设定的提醒间隔（分钟）
	ElapsedSeconds          int  `json:"elapsedSeconds"`          // 当前周期已进行秒数
	RemainingSeconds        int  `json:"remainingSeconds"`        // 距离下次休息提醒剩余秒数
	IsPaused                bool `json:"isPaused"`                // 是否处于手动暂停状态
	IsReminding             bool `json:"isReminding"`             // 是否正在触发休息提醒
	RestCount               int  `json:"restCount"`               // 今日已完成活动休息次数
	IsAway                  bool `json:"isAway"`                  // 是否检测到离座休息
	IsOffDuty               bool `json:"isOffDuty"`               // 是否判定为午休或下班中（不计入日常工作统计）
	IdleThresholdMinutes    int  `json:"idleThresholdMinutes"`    // 判定离座休息的空闲阈值（默认 3 分钟）
	OffDutyThresholdMinutes int  `json:"offDutyThresholdMinutes"` // 判定午休/下班的长时间休息阈值（默认 30 分钟）
	CurrentIdleSeconds      int  `json:"currentIdleSeconds"`      // 当前键盘鼠标连续空闲秒数
}

// ActivityStats 暴露给仪表盘小组件的数据统计模型
type ActivityStats struct {
	TodayFocusMinutes int     `json:"todayFocusMinutes"` // 今日累计专注分钟数
	TodayRestMinutes  int     `json:"todayRestMinutes"`  // 今日累计休息分钟数
	RestCount         int     `json:"restCount"`         // 今日休息次数
	CurrentState      string  `json:"currentState"`      // "working" | "reminding" | "away" | "paused"
	HourlyFocus       [24]int `json:"hourlyFocus"`       // 过去24小时各小时活跃工作分钟数（0~23点）
	TodayDate         string  `json:"todayDate"`         // 当前统计日期 YYYY-MM-DD
}

// Service 提供给前端绑定的活动提醒业务逻辑服务
type Service struct {
	mu              sync.RWMutex
	app             *application.App
	window          *application.WebviewWindow
	dashboardWindow *application.WebviewWindow
	tray            *application.SystemTray

	intervalMinutes         int
	elapsedSeconds          int
	remainingSeconds        int
	isPaused                bool
	isReminding             bool
	restCount               int
	isAway                  bool
	isOffDuty               bool // 当前是否处于午休或下班中
	idleThresholdMinutes    int
	offDutyThresholdMinutes int // 判定午休或下班的长时间休息阈值（默认 30 分钟）
	currentIdleSeconds      int
	awayDurationSeconds     int // 当前本次连续离座的累计秒数

	configMgr *config.ConfigManager
	storageDB *storage.DB

	// 绝对物理时钟锚定机制（消除 Ticker 漂移、系统调度延迟与电脑休眠落后）
	targetEndTime time.Time // 当前专注周期目标结束的真实物理时刻
	lastTickTime  time.Time // 上一次计算更新的真实物理时刻
	pausedAt      time.Time // 手动暂停发生时的真实物理时刻

	// 统计数据
	todayDate          string
	todayFocusSeconds  int
	todayRestSeconds   int
	hourlyFocusSeconds [24]int
	syncTickCount      int // 用于定时 15 秒向 SQLite 批量持久化

	// 专注轮次自动隐藏控制机制：
	// 每开启一轮新的专注（启动时、离座休息重返时、提醒后确认休息开始新一轮时、重置计时时），
	// 窗口都会在 5 秒倒数后平滑自动隐藏；
	// 若期间用户通过托盘/快捷键手动呼出窗口，则取消该轮自动隐藏，保持常驻直到手动关闭。
	autoHideCountdown  int  // 剩余自动隐藏倒计时秒数（<=0 表示不执行自动隐藏）
	userManuallyOpened bool // 用户是否在该轮中手动呼出了挂件窗口

	lastTrayLabel string // 上次设置的托盘文案缓存，避免无变动时频繁重排重绘 macOS 状态栏

	stopTicker chan struct{}
}

// NewService 初始化活动提醒服务，并自动从 SQLite 恢复今日历史专注数据
func NewService(configMgr *config.ConfigManager, storageDB *storage.DB) *Service {
	defaultMinutes := 30
	defaultIdleThreshold := 3
	defaultOffDutyThreshold := 30
	if configMgr != nil {
		cfg := configMgr.GetConfig()
		if cfg.IntervalMins > 0 {
			defaultMinutes = cfg.IntervalMins
		}
		if cfg.IdleThreshold > 0 {
			defaultIdleThreshold = cfg.IdleThreshold
		}
		if cfg.OffDutyThreshold > 0 {
			defaultOffDutyThreshold = cfg.OffDutyThreshold
		}
	}

	today := time.Now().Format("2006-01-02")
	var initialFocusSeconds int
	var initialRestSeconds int
	var initialRestCount int
	var initialHourly [24]int

	// 尝试从 SQLite 恢复当天的历史工作数据
	if storageDB != nil {
		if record, err := storageDB.GetDailyActivity(today); err == nil && record != nil {
			initialFocusSeconds = record.FocusSeconds
			initialRestSeconds = record.RestSeconds
			initialRestCount = record.RestCount
			initialHourly = record.HourlyFocusSeconds
			log.Printf("[ActivityService] 从 SQLite 数据库恢复今日历史工作状态: 专注 %d 分钟, 休息 %d 分钟, 休息打卡 %d 次",
				initialFocusSeconds/60, initialRestSeconds/60, initialRestCount)
		}
	}

	now := time.Now()
	targetEnd := now.Add(time.Duration(defaultMinutes) * time.Minute)

	return &Service{
		configMgr:            configMgr,
		storageDB:            storageDB,
		targetEndTime:        targetEnd,
		lastTickTime:         now,
		intervalMinutes:      defaultMinutes,
		elapsedSeconds:       0,
		remainingSeconds:     defaultMinutes * 60,
		isPaused:             false,
		isReminding:          false,
		restCount:            initialRestCount,
		isAway:                  false,
		isOffDuty:               false,
		idleThresholdMinutes:    defaultIdleThreshold,
		offDutyThresholdMinutes: defaultOffDutyThreshold,
		currentIdleSeconds:      0,
		awayDurationSeconds:     0,
		todayDate:            today,
		todayFocusSeconds:    initialFocusSeconds,
		todayRestSeconds:     initialRestSeconds,
		hourlyFocusSeconds:   initialHourly,
		autoHideCountdown:    5,     // 启动第一轮专注：默认 5 秒后自动隐藏
		userManuallyOpened:   false, // 未手动呼出
		stopTicker:           make(chan struct{}),
	}
}

// resetCycleToDurationLocked 按照真实物理时间戳重新校准开启新周期
func (s *Service) resetCycleToDurationLocked(minutes int) {
	now := time.Now()
	s.elapsedSeconds = 0
	s.remainingSeconds = minutes * 60
	s.targetEndTime = now.Add(time.Duration(minutes) * time.Minute)
	s.lastTickTime = now
	s.pausedAt = time.Time{}
}

// BindApp 将应用实例、悬浮窗口、看板窗口与系统托盘与服务进行关联
func (s *Service) BindApp(app *application.App, window *application.WebviewWindow, dashboardWindow *application.WebviewWindow, tray *application.SystemTray) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.app = app
	s.window = window
	s.dashboardWindow = dashboardWindow
	s.tray = tray

	// 启动后台定时任务
	go s.startTicker()
}

// startTicker 负责后台每秒定时检测硬件状态与递推时间
func (s *Service) startTicker() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopTicker:
			return
		case <-ticker.C:
			s.handleSecondTick()
		}
	}
}

// handleSecondTick 处理每一秒的时钟跳动与硬件空闲检测
func (s *Service) handleSecondTick() {
	// 获取系统自上次键盘/鼠标操作以来的物理空闲秒数
	idleSeconds := idle.GetSystemIdleTime()

	s.mu.Lock()

	now := time.Now()
	// 计算物理世界绝对真实时间增量（消除任务耗时导致的累计调度漂移）
	delta := int(now.Sub(s.lastTickTime).Seconds())
	if delta < 1 {
		delta = 1
	}
	s.lastTickTime = now

	// 检查日期跨越：凌晨自动重置今日统计（先将昨日数据归档写入 SQLite）
	todayStr := now.Format("2006-01-02")
	if todayStr != s.todayDate {
		s.saveToStorageLocked()
		s.todayDate = todayStr
		s.todayFocusSeconds = 0
		s.todayRestSeconds = 0
		s.restCount = 0
		s.hourlyFocusSeconds = [24]int{}
	}

	s.currentIdleSeconds = int(idleSeconds)
	thresholdSeconds := s.idleThresholdMinutes * 60
	offDutyThresholdSeconds := s.offDutyThresholdMinutes * 60
	userReturned := false
	shouldSyncStorage := false
	requestFadeOut := false
	windowShown := false

	// 定时向 SQLite 刷盘（每 15 秒一次，兼顾低 I/O 与数据安全性）
	s.syncTickCount++
	if s.syncTickCount >= 15 {
		s.syncTickCount = 0
		shouldSyncStorage = true
	}

	if s.isAway {
		// 场景 1：当前处于“离座休息”或“午休/下班”状态中
		// 检测到用户重新触摸了鼠标或按键（空闲时间很小，判定为返回工位）
		if idleSeconds < 2.0 {
			wasOffDuty := s.isOffDuty
			s.isAway = false
			s.isOffDuty = false
			s.isReminding = false
			s.awayDurationSeconds = 0

			// 只有正常工作工间的短休归位，才累加休息打卡次数
			// 午休或下班归来，重置状态重开专注，不记为日常工间休息打卡
			if !wasOffDuty {
				s.restCount++
			}
			userReturned = true

			// 离座归位：自动开启新一轮专注，绝对时间戳锚定
			s.resetCycleToDurationLocked(s.intervalMinutes)

			// 唤起挂件并启动 5 秒自动隐藏倒数
			s.userManuallyOpened = false
			s.autoHideCountdown = 5
			if s.window != nil {
				s.window.Show()
				windowShown = true
			}
		} else {
			// 用户仍未触摸键鼠，持续累计离开时长
			s.awayDurationSeconds += delta

			if !s.isOffDuty {
				if s.awayDurationSeconds >= offDutyThresholdSeconds {
					// 🚨 触发午休/下班判定！单次连续离开达到 N 分钟（默认 30m）
					// 将本次离座此前累加进入 todayRestSeconds 的时间完全剔除！
					s.isOffDuty = true
					s.todayRestSeconds -= s.awayDurationSeconds
					if s.todayRestSeconds < 0 {
						s.todayRestSeconds = 0
					}
					log.Printf("[ActivityService] 单次连续空闲达到 %d 分钟，自动判定为午休/下班，已将该段时长移出工作统计", s.offDutyThresholdMinutes)
				} else {
					// 仍在正常工间休息阈值内，正常计入日常休息
					s.todayRestSeconds += delta
				}
			} else {
				// 已经进入午休/下班状态：保持静默等待，绝对不再增加今日工作休息时长！
			}
		}
	} else {
		// 场景 2：用户此前在工作
		if int(idleSeconds) >= thresholdSeconds {
			// 连续未检测到键鼠活动超过阈值（默认 3 分钟），自动识别为离开工位
			s.isAway = true
			s.awayDurationSeconds = int(idleSeconds)

			if !s.isReminding && !s.isPaused {
				// 【核心修复 1】：用户此前处于专注工作中，过去 idleSeconds 秒此前在每秒 tick 中被加进了专注时长
				// 判定离座后，需从今日专注时长中精准回冲扣除，避免双重计数！
				rollbackSecs := int(idleSeconds)
				if rollbackSecs > s.todayFocusSeconds {
					rollbackSecs = s.todayFocusSeconds
				}
				s.todayFocusSeconds -= rollbackSecs
				curHour := now.Hour()
				if curHour >= 0 && curHour < 24 {
					s.hourlyFocusSeconds[curHour] -= rollbackSecs
					if s.hourlyFocusSeconds[curHour] < 0 {
						s.hourlyFocusSeconds[curHour] = 0
					}
				}

				if s.awayDurationSeconds >= offDutyThresholdSeconds {
					// 超过午休/下班阈值，离座时间移出工作日常统计
					s.isOffDuty = true
				} else {
					// 正常工间小休：将回冲的时长转入日常休息统计
					s.isOffDuty = false
					s.todayRestSeconds += rollbackSecs
				}
			} else {
				// 用户此前已在提醒中或主动暂停中：过去 idleSeconds 秒在每秒 tick 中已如实累加到了 todayRestSeconds，无需且绝不可重复累加！
				if s.awayDurationSeconds >= offDutyThresholdSeconds {
					// 超过午休阈值，将此前计入 todayRestSeconds 的离座时长剔除
					s.isOffDuty = true
					s.todayRestSeconds -= s.awayDurationSeconds
					if s.todayRestSeconds < 0 {
						s.todayRestSeconds = 0
					}
				} else {
					s.isOffDuty = false
				}
			}
		} else {
			// 用户处于正常活跃工作中
			if s.isReminding {
				s.todayRestSeconds += delta
			} else if s.isPaused {
				s.todayRestSeconds += delta
			} else {
				// 专注工作中：累加今日专注时长与当前小时走势
				s.todayFocusSeconds += delta
				curHour := now.Hour()
				if curHour >= 0 && curHour < 24 {
					s.hourlyFocusSeconds[curHour] += delta
				}

				// 【核心重构：绝对时间戳锚定】基于真实物理时钟计算剩余秒数，消除累加漂移与休眠误差
				diff := int((s.targetEndTime.Sub(now) + 999*time.Millisecond) / time.Second)
				if diff < 0 {
					diff = 0
				}
				s.remainingSeconds = diff
				s.elapsedSeconds = s.intervalMinutes*60 - s.remainingSeconds
				if s.elapsedSeconds < 0 {
					s.elapsedSeconds = 0
				}

				// 倒计时归零，触发活动提醒并主动展示挂件
				if s.remainingSeconds <= 0 {
					s.isReminding = true
					s.autoHideCountdown = 0 // 提醒中绝不自动隐藏，必须提醒到用户
					windowShown = true      // 仅置标志，锁外安全调用 window.Show() 杜绝死锁
				} else {
					// 专注工作进行中：执行每轮开始的 5 秒自动隐藏倒数
					if !s.userManuallyOpened && s.autoHideCountdown > 0 {
						s.autoHideCountdown--
						if s.autoHideCountdown == 0 {
							requestFadeOut = true
						}
					}
				}
			}
		}
	}

	state := s.buildStateLocked()
	stats := s.buildStatsLocked()
	tray := s.tray
	app := s.app
	window := s.window
	dash := s.dashboardWindow
	s.mu.Unlock()

	// 【核心修复 5】：锁外执行窗口操作，彻底消除主线程 CGO 同步死锁风险
	if windowShown && window != nil {
		window.Show()
	}

	// 判断窗口可见性，按需调度渲染更新以节省待机功耗
	widgetVisible := window != nil && window.IsVisible()
	dashVisible := dash != nil && dash.IsVisible()

	// 【核心修复 6】：广播事件按需唤醒，窗口不可见且无强事件时跳过广播，大幅降低待机耗电
	if app != nil {
		if widgetVisible || dashVisible || state.IsReminding || userReturned || windowShown || requestFadeOut {
			app.Event.Emit("reminder:tick", state)
		}
		if dashVisible || shouldSyncStorage || userReturned {
			app.Event.Emit("activity:stats-update", stats)
		}
		if userReturned {
			// 触发欢迎返回并开启新一轮倒计时的专用事件
			app.Event.Emit("reminder:returned", state)
		}
		if windowShown {
			app.Event.Emit("reminder:window-shown", nil)
		}
		if requestFadeOut {
			// 通知前端以丝滑动画平滑淡出，而非后端粗暴闪退
			app.Event.Emit("reminder:request-fade-out", nil)
		}
	}

	// 【核心修复 6】：动态更新托盘标题标签（仅在文案变化时更新，消除每秒强制重绘状态栏的功耗）
	if tray != nil {
		var label string
		if state.IsAway {
			if state.IsOffDuty {
				label = "🌙 午休/下班中"
			} else {
				label = "😴 离座休息中"
			}
		} else if state.IsReminding {
			label = "🚨 该活动啦!"
		} else if state.IsPaused {
			label = "⏸ 休息中"
		} else {
			mins := state.RemainingSeconds / 60
			secs := state.RemainingSeconds % 60
			label = fmt.Sprintf("⏳ %02d:%02d", mins, secs)
		}

		s.mu.Lock()
		labelChanged := label != s.lastTrayLabel
		if labelChanged {
			s.lastTrayLabel = label
		}
		s.mu.Unlock()

		if labelChanged {
			tray.SetLabel(label)
		}
	}

	// 异步持久化写入 SQLite
	if shouldSyncStorage || userReturned {
		s.saveToStorage()
	}
}

// buildStateLocked 构建当前快照（需要在加锁状态下调用）
func (s *Service) buildStateLocked() ReminderState {
	return ReminderState{
		IntervalMinutes:         s.intervalMinutes,
		ElapsedSeconds:          s.elapsedSeconds,
		RemainingSeconds:        s.remainingSeconds,
		IsPaused:                s.isPaused,
		IsReminding:             s.isReminding,
		RestCount:               s.restCount,
		IsAway:                  s.isAway,
		IsOffDuty:               s.isOffDuty,
		IdleThresholdMinutes:    s.idleThresholdMinutes,
		OffDutyThresholdMinutes: s.offDutyThresholdMinutes,
		CurrentIdleSeconds:      s.currentIdleSeconds,
	}
}

// buildStatsLocked 构建统计数据快照
func (s *Service) buildStatsLocked() ActivityStats {
	var hourly [24]int
	for i := 0; i < 24; i++ {
		// 秒数转换为分钟数
		hourly[i] = s.hourlyFocusSeconds[i] / 60
	}

	stateStr := "working"
	if s.isReminding {
		stateStr = "reminding"
	} else if s.isAway {
		if s.isOffDuty {
			stateStr = "offduty"
		} else {
			stateStr = "away"
		}
	} else if s.isPaused {
		stateStr = "paused"
	}

	return ActivityStats{
		TodayFocusMinutes: s.todayFocusSeconds / 60,
		TodayRestMinutes:  s.todayRestSeconds / 60,
		RestCount:         s.restCount,
		CurrentState:      stateStr,
		HourlyFocus:       hourly,
		TodayDate:         s.todayDate,
	}
}

// GetState 获取当前计时器状态
func (s *Service) GetState() ReminderState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.buildStateLocked()
}

// GetStats 获取当前统计数据（专注走势、总用时等）
func (s *Service) GetStats() ActivityStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.buildStatsLocked()
}

// SetInterval 调整工作提醒时间间隔（单位：分钟）
func (s *Service) SetInterval(minutes int) ReminderState {
	if minutes < 1 {
		minutes = 1
	}
	if minutes > 180 {
		minutes = 180
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.intervalMinutes = minutes
	// 绝对时间戳锚定：以当前时刻为准设定新目标时间
	s.resetCycleToDurationLocked(minutes)

	if s.configMgr != nil {
		s.configMgr.SaveInterval(minutes)
	}

	return s.buildStateLocked()
}

// SetIdleThreshold 调整离座判定阈值（单位：分钟）
func (s *Service) SetIdleThreshold(minutes int) ReminderState {
	if minutes < 1 {
		minutes = 1
	}
	if minutes > 60 {
		minutes = 60
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.idleThresholdMinutes = minutes

	if s.configMgr != nil {
		s.configMgr.SaveIdleThreshold(minutes)
	}

	return s.buildStateLocked()
}

// SetOffDutyThreshold 调整午休/下班判定阈值（单位：分钟，单次连续空闲超过该阈值不计入工作休息统计）
func (s *Service) SetOffDutyThreshold(minutes int) ReminderState {
	if minutes < 5 {
		minutes = 5
	}
	if minutes > 240 {
		minutes = 240
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.offDutyThresholdMinutes = minutes

	if s.configMgr != nil {
		s.configMgr.SaveOffDutyThreshold(minutes)
	}

	return s.buildStateLocked()
}

// AcknowledgeRest 用户点击完成活动：记录休息完成，重新开始计时
func (s *Service) AcknowledgeRest() ReminderState {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.isReminding = false
	s.isAway = false
	s.restCount++

	// 开启新一轮专注：绝对时间戳锚定重置
	s.resetCycleToDurationLocked(s.intervalMinutes)

	// 开启新一轮专注：5 秒自动隐藏倒数
	s.userManuallyOpened = false
	s.autoHideCountdown = 5

	s.saveToStorageLocked()
	return s.buildStateLocked()
}

// Snooze 稍后提醒（贪睡指定分钟数）
func (s *Service) Snooze(minutes int) ReminderState {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.isReminding = false
	// 贪睡指定分钟数：目标结束时间顺延对应时长
	s.resetCycleToDurationLocked(minutes)

	if s.window != nil {
		s.window.Hide()
	}

	return s.buildStateLocked()
}

// ResetTimer 重置当前周期计时器
func (s *Service) ResetTimer() ReminderState {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.isReminding = false
	s.isAway = false

	// 开启新一轮专注：绝对时间戳锚定重置
	s.resetCycleToDurationLocked(s.intervalMinutes)

	// 开启新一轮专注：5 秒自动隐藏倒数
	s.userManuallyOpened = false
	s.autoHideCountdown = 5

	s.saveToStorageLocked()
	return s.buildStateLocked()
}

// TogglePause 暂停或继续当前周期（暂停时冻结，恢复时精准顺延目标时间）
func (s *Service) TogglePause() ReminderState {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	s.isPaused = !s.isPaused
	if s.isPaused {
		s.pausedAt = now
	} else {
		if !s.pausedAt.IsZero() {
			pauseDuration := now.Sub(s.pausedAt)
			s.targetEndTime = s.targetEndTime.Add(pauseDuration)
			s.pausedAt = time.Time{}
		}
		s.lastTickTime = now
	}

	return s.buildStateLocked()
}

// OnWindowLostFocus 窗口失去焦点时的处理逻辑（纯状态内存处理，窗口操作放锁外防死锁）
func (s *Service) OnWindowLostFocus() {
	s.mu.Lock()
	// 检查是否开启失焦收起
	if s.configMgr != nil && !s.configMgr.GetConfig().AutoHideWidget {
		s.mu.Unlock()
		return
	}

	// 如果正在强提醒中，不执行失焦收起
	if s.isReminding {
		s.mu.Unlock()
		return
	}

	s.autoHideCountdown = 0
	window := s.window
	s.mu.Unlock()

	// 【核心修复 5】：锁外安全调用窗口方法，杜绝 Cocoa 主线程与 Goroutine 互等死锁
	if window != nil && window.IsVisible() {
		window.Hide()
	}
}

// HideWindow 隐藏悬浮挂件
func (s *Service) HideWindow() {
	s.mu.Lock()
	s.autoHideCountdown = 0
	window := s.window
	s.mu.Unlock()

	if window != nil {
		window.Hide()
	}
}

// ShowWindow 显示悬浮挂件（用户主动呼出）
func (s *Service) ShowWindow() {
	s.mu.Lock()
	s.userManuallyOpened = true
	s.autoHideCountdown = 0
	window := s.window
	app := s.app
	s.mu.Unlock()

	if window != nil {
		window.Show()
		window.Focus()
	}
	if app != nil {
		app.Event.Emit("reminder:window-shown", nil)
	}
}

// ToggleWindow 切换悬浮挂件显示与隐藏（锁内状态纯化，锁外执行窗口 API）
func (s *Service) ToggleWindow() {
	s.mu.Lock()
	window := s.window
	app := s.app
	s.autoHideCountdown = 0
	s.mu.Unlock()

	if window == nil {
		return
	}

	// 【核心修复 5】：IsVisible、Hide、Show 全部置于锁外安全调度
	if window.IsVisible() {
		window.Hide()
	} else {
		s.mu.Lock()
		s.userManuallyOpened = true
		s.mu.Unlock()

		window.Show()
		if app != nil {
			app.Event.Emit("reminder:window-shown", nil)
		}
	}
}

// OpenDashboard 打开/置顶主控制看板
func (s *Service) OpenDashboard() {
	s.mu.RLock()
	dash := s.dashboardWindow
	s.mu.RUnlock()

	if dash != nil {
		dash.Show()
		dash.Focus()
	}
}

// Quit 退出应用程序（先安全同步刷盘保存今日最新状态，彻底解决退出丢数据窗口）
func (s *Service) Quit() {
	// 【核心修复 2】：退出路径采用同步刷盘，避免 goroutine 异步未写完进程就退出的丢数据窗口
	s.saveToStorageSync()
	s.mu.RLock()
	app := s.app
	s.mu.RUnlock()

	if app != nil {
		app.Quit()
	}
}

// saveToStorageSync 同步将今日状态写入 SQLite（用于退出等必须保证刷盘完成的场景）
func (s *Service) saveToStorageSync() {
	s.mu.RLock()
	db := s.storageDB
	date := s.todayDate
	focus := s.todayFocusSeconds
	rest := s.todayRestSeconds
	count := s.restCount
	hourly := s.hourlyFocusSeconds
	s.mu.RUnlock()

	if db == nil || date == "" {
		return
	}

	item := &storage.DailyActivity{
		Date:               date,
		FocusSeconds:       focus,
		RestSeconds:        rest,
		RestCount:          count,
		HourlyFocusSeconds: hourly,
	}

	if err := db.SaveDailyActivity(item); err != nil {
		log.Printf("[ActivityService] 退出前同步写入 SQLite 失败: %v", err)
	} else {
		log.Printf("[ActivityService] 退出前今日数据已安全同步刷入 SQLite 存储")
	}
}

// saveToStorage 将今日状态异步写入 SQLite
func (s *Service) saveToStorage() {
	s.mu.RLock()
	db := s.storageDB
	date := s.todayDate
	focus := s.todayFocusSeconds
	rest := s.todayRestSeconds
	count := s.restCount
	hourly := s.hourlyFocusSeconds
	s.mu.RUnlock()

	if db == nil || date == "" {
		return
	}

	item := &storage.DailyActivity{
		Date:               date,
		FocusSeconds:       focus,
		RestSeconds:        rest,
		RestCount:          count,
		HourlyFocusSeconds: hourly,
	}

	go func(record *storage.DailyActivity) {
		if err := db.SaveDailyActivity(record); err != nil {
			log.Printf("[ActivityService] 写入 SQLite 失败: %v", err)
		}
	}(item)
}

// saveToStorageLocked 在已有锁状态下同步或异步入库
func (s *Service) saveToStorageLocked() {
	db := s.storageDB
	date := s.todayDate
	if db == nil || date == "" {
		return
	}

	item := &storage.DailyActivity{
		Date:               date,
		FocusSeconds:       s.todayFocusSeconds,
		RestSeconds:        s.todayRestSeconds,
		RestCount:          s.restCount,
		HourlyFocusSeconds: s.hourlyFocusSeconds,
	}

	go func(record *storage.DailyActivity) {
		if err := db.SaveDailyActivity(record); err != nil {
			log.Printf("[ActivityService] 归档写入 SQLite 失败: %v", err)
		}
	}(item)
}

// GetDailyHistory 获取最近 N 天的历史活动统计数据（供看板或后续图表组件使用）
func (s *Service) GetDailyHistory(days int) ([]storage.DailyActivity, error) {
	s.mu.RLock()
	db := s.storageDB
	s.mu.RUnlock()

	if db == nil {
		return nil, nil
	}
	if days <= 0 {
		days = 7
	}
	return db.GetRecentDailyActivities(days)
}
