/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 活动与专注业务门面服务（ActivityService Facade），负责调度状态机、统计聚合器、键鼠硬件感知与 Wails 窗口托盘集成
 **/

package activity

import (
	"log"
	"sync"
	"time"

	"workpet/pkg/config"
	"workpet/pkg/idle"
	"workpet/pkg/storage"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ReminderState 前端同步的专注与休息实时状态数据模型
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
	CurrentState      string  `json:"currentState"`      // "working" | "reminding" | "away" | "paused" | "offduty"
	HourlyFocus       [24]int `json:"hourlyFocus"`       // 过去24小时各小时活跃工作分钟数（0~23点）
	TodayDate         string  `json:"todayDate"`         // 当前统计日期 YYYY-MM-DD
}

// Service 提供给前端绑定的活动提醒业务门面服务
type Service struct {
	mu              sync.RWMutex
	app             *application.App
	window          *application.WebviewWindow
	dashboardWindow *application.WebviewWindow
	tray            *application.SystemTray

	stateMachine *FocusStateMachine
	aggregator   *StatsAggregator

	configMgr *config.ConfigManager
	storageDB *storage.DB

	lastTickTime  time.Time
	lastIdleSecs  int
	syncTickCount int
	lastTrayLabel string
	lastStats     ActivityStats

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
	aggregator := NewStatsAggregator(today)

	// 尝试从 SQLite 恢复当天的历史工作数据
	if storageDB != nil {
		if record, err := storageDB.GetDailyActivity(today); err == nil && record != nil {
			aggregator.RestoreFromStorage(record)
			log.Printf("[ActivityService] 从 SQLite 数据库恢复今日历史工作状态: 专注 %d 分钟, 休息 %d 分钟, 休息打卡 %d 次",
				record.FocusSeconds/60, record.RestSeconds/60, record.RestCount)
		}
	}

	stateMachine := NewFocusStateMachine(defaultMinutes, defaultIdleThreshold, defaultOffDutyThreshold)

	return &Service{
		configMgr:     configMgr,
		storageDB:     storageDB,
		stateMachine:  stateMachine,
		aggregator:    aggregator,
		lastTickTime:  time.Now(),
		stopTicker:    make(chan struct{}),
	}
}

// BindApp 挂载 Wails 原生窗口与托盘，并启动定时轮询状态驱动协程
func (s *Service) BindApp(
	app *application.App,
	window *application.WebviewWindow,
	dashboardWindow *application.WebviewWindow,
	tray *application.SystemTray,
) {
	s.mu.Lock()
	s.app = app
	s.window = window
	s.dashboardWindow = dashboardWindow
	s.tray = tray
	s.mu.Unlock()

	go s.startSecondTicker()
}

// startSecondTicker 启动每秒绝对物理时钟心跳驱动
func (s *Service) startSecondTicker() {
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

// handleSecondTick 执行每秒业务驱动与事件广播
func (s *Service) handleSecondTick() {
	idleSeconds := idle.GetSystemIdleTime()

	s.mu.Lock()
	now := time.Now()
	delta := int(now.Sub(s.lastTickTime).Seconds())
	if delta < 1 {
		delta = 1
	}
	s.lastTickTime = now
	s.lastIdleSecs = int(idleSeconds)

	// 1. 跨天归档检测
	isNewDay, yesterdayData := s.aggregator.CheckDayReset(now)
	if isNewDay && s.storageDB != nil {
		_ = s.storageDB.SaveDailyActivity(&yesterdayData)
	}

	// 2. 定时向 SQLite 刷盘（每 15 秒一次）
	s.syncTickCount++
	shouldSyncStorage := false
	if s.syncTickCount >= 15 {
		s.syncTickCount = 0
		shouldSyncStorage = true
	}

	// 3. 状态机推进步进
	event := s.stateMachine.Step(delta, idleSeconds, now)

	// 4. 将状态机产生的统计增减与回冲指令应用到聚合器
	curHour := now.Hour()
	if event.AddFocusSeconds > 0 {
		s.aggregator.AddFocus(event.AddFocusSeconds, curHour)
	}
	if event.RollbackFocusSeconds > 0 {
		s.aggregator.RollbackFocus(event.RollbackFocusSeconds, curHour)
	}
	if event.AddRestSeconds > 0 {
		s.aggregator.AddRest(event.AddRestSeconds)
	}
	if event.RollbackRestSeconds > 0 {
		s.aggregator.RollbackRest(event.RollbackRestSeconds)
	}
	if event.IncrementRestCount {
		s.aggregator.IncrementRestCount()
	}

	// 5. 准备广播状态快照
	currentStatus := s.stateMachine.GetCurrentStatus()
	stats := s.aggregator.GetStatsSnapshot(currentStatus)
	state := s.stateMachine.GetReminderState(stats.RestCount, int(idleSeconds))

	// 脏检查：对比统计指标是否有实质变化，避免每秒无谓跨进程 IPC 广播
	statsChanged := stats != s.lastStats
	if statsChanged {
		s.lastStats = stats
	}

	tray := s.tray
	app := s.app
	window := s.window
	dash := s.dashboardWindow
	s.mu.Unlock()

	// 6. 锁外安全操作窗口，杜绝 Cocoa / Win32 主线程死锁
	if event.ShowWidget && window != nil {
		window.Show()
	}

	// 7. 按需唤醒广播事件（大幅降低待机耗电与 WebView 进程频繁唤醒）
	widgetVisible := window != nil && window.IsVisible()
	dashVisible := dash != nil && dash.IsVisible()

	if app != nil {
		if widgetVisible || dashVisible || state.IsReminding || event.UserReturned || event.ShowWidget || event.RequestFadeOut {
			app.Event.Emit("reminder:tick", state)
		}
		// 走势与累计指标仅在统计数据实际变动、离座归位、跨天重置或落盘同步时广播（由每秒 1 次降为仅变动时广播）
		if dashVisible && (statsChanged || event.UserReturned || isNewDay || shouldSyncStorage) {
			app.Event.Emit("activity:stats-update", stats)
		}
		if event.UserReturned {
			app.Event.Emit("reminder:returned", state)
		}
		if event.ShowWidget {
			app.Event.Emit("reminder:window-shown", nil)
		}
		if event.RequestFadeOut {
			app.Event.Emit("reminder:request-fade-out", nil)
		}
	}

	// 8. 托盘文案更新（仅在文案变化时更新，消除每秒强制重绘状态栏的功耗）
	if tray != nil {
		newLabel := FormatTrayLabel(state)
		s.mu.Lock()
		if newLabel != s.lastTrayLabel {
			s.lastTrayLabel = newLabel
			s.mu.Unlock()
			tray.SetLabel(newLabel)
		} else {
			s.mu.Unlock()
		}
	}

	// 9. 定时批量落盘
	if shouldSyncStorage {
		s.saveToStorage()
	}
}

// GetState 获取当前专注倒计时与提醒状态快照
func (s *Service) GetState() ReminderState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := s.aggregator.GetStatsSnapshot(s.stateMachine.GetCurrentStatus())
	return s.stateMachine.GetReminderState(stats.RestCount, s.lastIdleSecs)
}

// GetStats 获取当前今日统计汇总数据
func (s *Service) GetStats() ActivityStats {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.aggregator.GetStatsSnapshot(s.stateMachine.GetCurrentStatus())
}

// Acknowledge 用户点击“已休息”确认按钮
func (s *Service) Acknowledge() {
	s.stateMachine.Acknowledge()
	s.mu.Lock()
	window := s.window
	s.mu.Unlock()

	if window != nil {
		window.Hide()
	}
	s.saveToStorage()
}

// AcknowledgeRest 兼容托盘菜单与外部调用的已活动确认
func (s *Service) AcknowledgeRest() {
	s.Acknowledge()
}

// Snooze 用户点击延后提醒
func (s *Service) Snooze(minutes int) {
	s.stateMachine.Snooze(minutes)
	s.mu.Lock()
	window := s.window
	s.mu.Unlock()

	if window != nil {
		window.Hide()
	}
	s.saveToStorage()
}

// TogglePause 手动暂停 / 继续计时
func (s *Service) TogglePause() bool {
	paused := s.stateMachine.TogglePause()
	s.saveToStorage()
	return paused
}

// Reset 重置当前专注周期
func (s *Service) Reset() {
	s.stateMachine.Reset()
	s.saveToStorage()
}

// SetInterval 动态设置专注时长间隔
func (s *Service) SetInterval(minutes int) {
	s.stateMachine.SetInterval(minutes)
	if s.configMgr != nil {
		s.configMgr.SaveInterval(minutes)
	}
	s.saveToStorage()
}

// SetIdleThreshold 动态设置离座空闲判定阈值
func (s *Service) SetIdleThreshold(minutes int) {
	s.stateMachine.SetIdleThreshold(minutes)
	if s.configMgr != nil {
		s.configMgr.SaveIdleThreshold(minutes)
	}
}

// SetOffDutyThreshold 动态设置午休/下班判定阈值
func (s *Service) SetOffDutyThreshold(minutes int) {
	s.stateMachine.SetOffDutyThreshold(minutes)
	if s.configMgr != nil {
		s.configMgr.SaveOffDutyThreshold(minutes)
	}
}

// OnWindowLostFocus 当随行小组件失去焦点时调用
func (s *Service) OnWindowLostFocus() {
	s.mu.RLock()
	autoHideEnabled := false
	if s.configMgr != nil {
		autoHideEnabled = s.configMgr.GetConfig().AutoHideWidget
	}
	isReminding := s.stateMachine.isReminding
	window := s.window
	dash := s.dashboardWindow
	s.mu.RUnlock()

	// 提醒阶段或未开启失焦隐藏时不收起
	if isReminding || !autoHideEnabled {
		return
	}

	// 若当前主控制看板处于可见状态（焦点转移到了看板），绝不误伤挂件
	if dash != nil && dash.IsVisible() {
		return
	}

	if window != nil {
		window.Hide()
	}
}

// HideWindow 隐藏随行挂件小窗口
func (s *Service) HideWindow() {
	s.mu.RLock()
	window := s.window
	s.mu.RUnlock()

	if window != nil {
		window.Hide()
	}
}

// ShowWindow 唤出随行挂件小窗口
func (s *Service) ShowWindow() {
	s.stateMachine.SetUserManuallyOpened(true)

	s.mu.RLock()
	window := s.window
	s.mu.RUnlock()

	if window != nil {
		window.Show()
		window.Focus()
	}
}

// ToggleWindow 切换随行挂件小窗口的显隐状态
func (s *Service) ToggleWindow() {
	s.mu.RLock()
	window := s.window
	s.mu.RUnlock()

	if window == nil {
		return
	}

	if window.IsVisible() {
		window.Hide()
	} else {
		s.stateMachine.SetUserManuallyOpened(true)
		window.Show()
		window.Focus()
	}
}

// saveToStorage 异步将统计数据写入 SQLite
func (s *Service) saveToStorage() {
	if s.storageDB == nil {
		return
	}

	data := s.aggregator.ToDailyActivity()
	go func() {
		if err := s.storageDB.SaveDailyActivity(&data); err != nil {
			log.Printf("[ActivityService] 异步保存活动数据到 SQLite 失败: %v", err)
		}
	}()
}

// saveToStorageSync 同步落盘，用于进程退出前确保最后一次增量绝不丢失
func (s *Service) saveToStorageSync() {
	if s.storageDB == nil {
		return
	}
	data := s.aggregator.ToDailyActivity()
	if err := s.storageDB.SaveDailyActivity(&data); err != nil {
		log.Printf("[ActivityService] 同步保存活动数据到 SQLite 失败: %v", err)
	}
}

// Quit 退出应用程序，执行严谨的同步持久化后再终止进程
func (s *Service) Quit() {
	log.Printf("[ActivityService] 收到退出指令，正在执行最终数据同步持久化...")

	// 1. 同步将所有内存统计刷盘到 SQLite
	s.saveToStorageSync()

	// 2. 同步将配置管理器未落盘的配置刷盘
	if s.configMgr != nil {
		s.configMgr.Flush()
	}

	// 3. 停止心跳
	close(s.stopTicker)

	// 4. 安全退出应用
	if s.app != nil {
		s.app.Quit()
	}
}
