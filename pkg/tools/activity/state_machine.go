/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 专注作息状态机（FocusStateMachine），负责工作倒计时、离座感知、午休判定与提醒状态流转（纯逻辑，可独立单测）
 **/

package activity

import (
	"sync"
	"time"
)

// StateType 专注作息内部状态枚举
type StateType string

const (
	StateWorking   StateType = "working"
	StateReminding StateType = "reminding"
	StateAway      StateType = "away"
	StateOffDuty   StateType = "offduty"
	StatePaused    StateType = "paused"
)

// StepEvent 每秒推进时产生的外溢事件与副作用指令，交由外层 Facade 编排
type StepEvent struct {
	AddFocusSeconds      int  // 本秒需计入专注的秒数
	RollbackFocusSeconds int  // 刚判定离座时需从专注回冲扣除的秒数
	AddRestSeconds       int  // 本秒需计入休息的秒数
	RollbackRestSeconds  int  // 判定午休时需剔除回冲的休息秒数
	IncrementRestCount   bool // 是否完成了一次有效工间休息打卡

	TriggerRemind  bool // 倒计时归零，触发提醒
	UserReturned   bool // 用户离开后归位返回
	ShowWidget     bool // 需要唤出随行挂件窗口
	RequestFadeOut bool // 5秒展示结束，请求前端淡出收起
}

// FocusStateMachine 专注状态机纯逻辑实现
type FocusStateMachine struct {
	mu sync.RWMutex

	intervalMinutes         int
	idleThresholdMinutes    int
	offDutyThresholdMinutes int

	remainingSeconds    int
	elapsedSeconds      int
	targetEndTime       time.Time
	awayDurationSeconds int
	autoHideCountdown   int
	userManuallyOpened  bool

	isPaused    bool
	isReminding bool
	isAway      bool
	isOffDuty   bool
}

// NewFocusStateMachine 创建状态机
func NewFocusStateMachine(intervalMins, idleThresholdMins, offDutyThresholdMins int) *FocusStateMachine {
	if intervalMins <= 0 {
		intervalMins = 30
	}
	if idleThresholdMins <= 0 {
		idleThresholdMins = 3
	}
	if offDutyThresholdMins <= 0 {
		offDutyThresholdMins = 30
	}

	sm := &FocusStateMachine{
		intervalMinutes:         intervalMins,
		idleThresholdMinutes:    idleThresholdMins,
		offDutyThresholdMinutes: offDutyThresholdMins,
	}
	sm.resetCycleToDurationLocked(intervalMins)
	return sm
}

// Step 每秒推进时钟计算状态迁移，返回需要执行的统计增减与窗口操作指令
func (sm *FocusStateMachine) Step(delta int, idleSeconds float64, now time.Time) StepEvent {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	var event StepEvent
	thresholdSeconds := sm.idleThresholdMinutes * 60
	offDutyThresholdSeconds := sm.offDutyThresholdMinutes * 60

	if sm.isAway {
		// 场景 1：当前处于“离座”或“午休/下班”中
		if idleSeconds < 2.0 {
			// 检测到用户重新触摸键鼠：判定归位
			wasOffDuty := sm.isOffDuty
			sm.isAway = false
			sm.isOffDuty = false
			sm.isReminding = false
			sm.awayDurationSeconds = 0

			// 仅正常工间休息归位计入打卡
			if !wasOffDuty {
				event.IncrementRestCount = true
			}
			event.UserReturned = true

			// 重新开启新一轮专注倒计时
			sm.resetCycleToDurationLocked(sm.intervalMinutes)

			// 唤起小组件并启动 5 秒自动隐藏倒数
			sm.userManuallyOpened = false
			sm.autoHideCountdown = 5
			event.ShowWidget = true
		} else {
			// 用户仍未操作电脑，继续累计离开时间
			sm.awayDurationSeconds += delta

			if !sm.isOffDuty {
				if sm.awayDurationSeconds >= offDutyThresholdSeconds {
					// 触发午休/下班判定：将此前累加进休息的时长剔除
					sm.isOffDuty = true
					event.RollbackRestSeconds = sm.awayDurationSeconds
				} else {
					// 正常工间小休，累加休息秒数
					event.AddRestSeconds = delta
				}
			}
		}
		return event
	}

	// 场景 2：用户此前在工位
	if int(idleSeconds) >= thresholdSeconds {
		// 超过空闲阈值，识别为离座
		sm.isAway = true
		sm.awayDurationSeconds = int(idleSeconds)

		if !sm.isReminding && !sm.isPaused {
			// 离座前处于专注工作中：需要将过去的 idleSeconds 秒从专注中精准回冲扣除
			event.RollbackFocusSeconds = int(idleSeconds)

			if sm.awayDurationSeconds >= offDutyThresholdSeconds {
				sm.isOffDuty = true
			} else {
				sm.isOffDuty = false
				// 正常离座短休，转入休息累加
				event.AddRestSeconds = int(idleSeconds)
			}
		} else {
			// 此前处于提醒或暂停中：过去的 idleSeconds 已经在每秒 tick 中累加过了
			if sm.awayDurationSeconds >= offDutyThresholdSeconds {
				sm.isOffDuty = true
				event.RollbackRestSeconds = sm.awayDurationSeconds
			} else {
				sm.isOffDuty = false
			}
		}
		return event
	}

	// 场景 3：用户处于正常活跃工作状态
	if sm.isReminding {
		event.AddRestSeconds = delta
	} else if sm.isPaused {
		event.AddRestSeconds = delta
	} else {
		// 正常专注中
		event.AddFocusSeconds = delta

		// 基于绝对物理时间戳计算剩余秒数，消除累加漂移
		diff := int((sm.targetEndTime.Sub(now) + 999*time.Millisecond) / time.Second)
		if diff < 0 {
			diff = 0
		}
		sm.remainingSeconds = diff
		sm.elapsedSeconds = sm.intervalMinutes*60 - sm.remainingSeconds
		if sm.elapsedSeconds < 0 {
			sm.elapsedSeconds = 0
		}

		// 倒计时归零，触发活动提醒
		if sm.remainingSeconds <= 0 {
			sm.isReminding = true
			sm.autoHideCountdown = 0
			event.TriggerRemind = true
			event.ShowWidget = true
		} else {
			// 专注中检查 5 秒自动隐藏
			if !sm.userManuallyOpened && sm.autoHideCountdown > 0 {
				sm.autoHideCountdown--
				if sm.autoHideCountdown == 0 {
					event.RequestFadeOut = true
				}
			}
		}
	}

	return event
}

// TogglePause 切换暂停 / 继续
func (sm *FocusStateMachine) TogglePause() bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.isPaused = !sm.isPaused
	if !sm.isPaused {
		// 继续专注：重新锚定物理结束时间
		sm.targetEndTime = time.Now().Add(time.Duration(sm.remainingSeconds) * time.Second)
	}
	return sm.isPaused
}

// Reset 重置当前专注周期
func (sm *FocusStateMachine) Reset() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.resetCycleToDurationLocked(sm.intervalMinutes)
}

// Snooze 延后提醒指定分钟数
func (sm *FocusStateMachine) Snooze(minutes int) {
	if minutes <= 0 {
		minutes = 5
	}
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.resetCycleToDurationLocked(minutes)
}

// Acknowledge 确认已完成休息，开启下一轮标准专注
func (sm *FocusStateMachine) Acknowledge() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.resetCycleToDurationLocked(sm.intervalMinutes)
}

// SetInterval 调整专注周期
func (sm *FocusStateMachine) SetInterval(minutes int) {
	if minutes <= 0 {
		return
	}
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.intervalMinutes = minutes
	sm.resetCycleToDurationLocked(minutes)
}

// SetIdleThreshold 调整空闲离座阈值（分钟）
func (sm *FocusStateMachine) SetIdleThreshold(minutes int) {
	if minutes <= 0 {
		return
	}
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.idleThresholdMinutes = minutes
}

// SetOffDutyThreshold 调整午休下班阈值（分钟）
func (sm *FocusStateMachine) SetOffDutyThreshold(minutes int) {
	if minutes <= 0 {
		return
	}
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.offDutyThresholdMinutes = minutes
}

// SetUserManuallyOpened 标记用户是否手动打开了窗口
func (sm *FocusStateMachine) SetUserManuallyOpened(opened bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.userManuallyOpened = opened
	if opened {
		sm.autoHideCountdown = 0
	}
}

// GetCurrentStatus 提取当前统一状态描述字符串
func (sm *FocusStateMachine) GetCurrentStatus() string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if sm.isAway {
		if sm.isOffDuty {
			return string(StateOffDuty)
		}
		return string(StateAway)
	}
	if sm.isReminding {
		return string(StateReminding)
	}
	if sm.isPaused {
		return string(StatePaused)
	}
	return string(StateWorking)
}

// GetReminderState 获取给前端同步的完整状态快照
func (sm *FocusStateMachine) GetReminderState(restCount, currentIdleSeconds int) ReminderState {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return ReminderState{
		IntervalMinutes:         sm.intervalMinutes,
		ElapsedSeconds:          sm.elapsedSeconds,
		RemainingSeconds:        sm.remainingSeconds,
		IsPaused:                sm.isPaused,
		IsReminding:             sm.isReminding,
		RestCount:               restCount,
		IsAway:                  sm.isAway,
		IsOffDuty:               sm.isOffDuty,
		IdleThresholdMinutes:    sm.idleThresholdMinutes,
		OffDutyThresholdMinutes: sm.offDutyThresholdMinutes,
		CurrentIdleSeconds:      currentIdleSeconds,
	}
}

// resetCycleToDurationLocked 重置倒计时周期（需在锁内调用）
func (sm *FocusStateMachine) resetCycleToDurationLocked(minutes int) {
	sm.remainingSeconds = minutes * 60
	sm.elapsedSeconds = 0
	sm.isPaused = false
	sm.isReminding = false
	sm.isAway = false
	sm.isOffDuty = false
	sm.awayDurationSeconds = 0
	sm.targetEndTime = time.Now().Add(time.Duration(minutes) * time.Minute)
}
