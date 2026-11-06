/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 专注状态机（FocusStateMachine）完整单元测试，覆盖状态流转、离座回冲与超时午休
 **/

package activity

import (
	"testing"
	"time"
)

func TestFocusStateMachine_NormalFocusAndRemind(t *testing.T) {
	// 创建 1 分钟短周期的状态机便于测试
	sm := NewFocusStateMachine(1, 3, 30)

	now := time.Now()
	// 推进 59 秒活跃工作
	evt := sm.Step(59, 0, now.Add(59*time.Second))
	if evt.AddFocusSeconds != 59 {
		t.Fatalf("应当累加 59 秒专注，实际为: %d", evt.AddFocusSeconds)
	}
	if evt.TriggerRemind {
		t.Fatalf("59 秒时不应触发提醒")
	}

	// 推进第 60 秒，倒计时归零，触发提醒
	evt2 := sm.Step(1, 0, now.Add(60*time.Second))
	if !evt2.TriggerRemind || !evt2.ShowWidget {
		t.Fatalf("倒计时结束必须触发提醒并展示挂件: %+v", evt2)
	}
	if sm.GetCurrentStatus() != string(StateReminding) {
		t.Fatalf("期望状态为 reminding，实际为: %s", sm.GetCurrentStatus())
	}
}

func TestFocusStateMachine_AwayAndRollback(t *testing.T) {
	// 30分钟周期，3分钟离座阈值，30分钟午休阈值
	sm := NewFocusStateMachine(30, 3, 30)
	now := time.Now()

	// 模拟已连续空闲 180 秒（达到 3 分钟阈值）
	evt := sm.Step(1, 180.0, now)
	if evt.RollbackFocusSeconds != 180 {
		t.Fatalf("首次判定离座必须指示回冲过去 180 秒专注，实际为: %d", evt.RollbackFocusSeconds)
	}
	if evt.AddRestSeconds != 180 {
		t.Fatalf("离座短休应当将 180 秒转为休息，实际为: %d", evt.AddRestSeconds)
	}
	if sm.GetCurrentStatus() != string(StateAway) {
		t.Fatalf("期望状态为 away，实际为: %s", sm.GetCurrentStatus())
	}

	// 用户在离座状态下重新触摸键鼠（idleSeconds < 2），判定归位
	evt2 := sm.Step(1, 0.5, now.Add(10*time.Second))
	if !evt2.UserReturned {
		t.Fatalf("用户重新触摸键鼠应判定归位")
	}
	if !evt2.IncrementRestCount {
		t.Fatalf("正常工间小休归位应当递增休息打卡次数")
	}
	if !evt2.ShowWidget {
		t.Fatalf("归位应当唤醒小组件")
	}
	if sm.GetCurrentStatus() != string(StateWorking) {
		t.Fatalf("归位后应重回 working 状态")
	}
}

func TestFocusStateMachine_OffDutyThreshold(t *testing.T) {
	sm := NewFocusStateMachine(30, 3, 30)
	now := time.Now()

	// 1. 进入离座状态 (已空闲 180 秒)
	_ = sm.Step(1, 180.0, now)

	// 2. 模拟单次离开持续达到 30 分钟 (1800 秒)
	// 连续累加到 1800 秒
	evt := sm.Step(1620, 1800.0, now.Add(30*time.Minute))
	if evt.RollbackRestSeconds != 1800 {
		t.Fatalf("达到午休阈值必须将全部离座时间 (1800s) 从休息中剔除，实际剔除: %d", evt.RollbackRestSeconds)
	}
	if sm.GetCurrentStatus() != string(StateOffDuty) {
		t.Fatalf("期望状态为 offduty，实际为: %s", sm.GetCurrentStatus())
	}

	// 3. 午休结束后用户重新操作电脑
	evtReturn := sm.Step(1, 0.5, now.Add(45*time.Minute))
	if !evtReturn.UserReturned {
		t.Fatalf("午休归来应触发 UserReturned")
	}
	if evtReturn.IncrementRestCount {
		t.Fatalf("午休/下班归来不应当累加日常工间小休打卡")
	}
}

func TestFocusStateMachine_PauseAndResume(t *testing.T) {
	sm := NewFocusStateMachine(30, 3, 30)

	// 暂停
	paused := sm.TogglePause()
	if !paused || sm.GetCurrentStatus() != string(StatePaused) {
		t.Fatalf("期望暂停状态")
	}

	// 暂停中的 Step 应产生休息秒数
	evt := sm.Step(10, 0, time.Now())
	if evt.AddRestSeconds != 10 {
		t.Fatalf("暂停期间应当计入休息时长")
	}

	// 继续
	paused2 := sm.TogglePause()
	if paused2 || sm.GetCurrentStatus() != string(StateWorking) {
		t.Fatalf("期望恢复工作状态")
	}
}
