/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 专注度与活动统计聚合器（StatsAggregator）单元测试用例，覆盖增量累加、离座回冲与跨天重置
 **/

package activity

import (
	"testing"
	"time"
)

func TestStatsAggregator_AddAndRollbackFocus(t *testing.T) {
	agg := NewStatsAggregator("2026-11-06")

	// 1. 模拟在 14 点专注了 600 秒
	agg.AddFocus(600, 14)
	snapshot := agg.GetStatsSnapshot("working")
	if snapshot.TodayFocusMinutes != 10 {
		t.Fatalf("期望专注分钟为 10，实际为: %d", snapshot.TodayFocusMinutes)
	}
	if snapshot.HourlyFocus[14] != 10 {
		t.Fatalf("期望 14 点专注分钟为 10，实际为: %d", snapshot.HourlyFocus[14])
	}

	// 2. 模拟检测到离座 180 秒（回冲 180 秒）
	rolledBack := agg.RollbackFocus(180, 14)
	if rolledBack != 180 {
		t.Fatalf("期望回冲 180 秒，实际为: %d", rolledBack)
	}

	snapshot2 := agg.GetStatsSnapshot("away")
	if snapshot2.TodayFocusMinutes != 7 { // (600 - 180) / 60 = 7
		t.Fatalf("期望回冲后专注分钟为 7，实际为: %d", snapshot2.TodayFocusMinutes)
	}
	if snapshot2.HourlyFocus[14] != 7 {
		t.Fatalf("期望回冲后 14 点专注分钟为 7，实际为: %d", snapshot2.HourlyFocus[14])
	}

	// 3. 边界测试：回冲超过当前总专注时长，不能减为负数
	agg.RollbackFocus(1000, 14)
	snapshot3 := agg.GetStatsSnapshot("away")
	if snapshot3.TodayFocusMinutes != 0 || snapshot3.HourlyFocus[14] != 0 {
		t.Fatalf("超额回冲不应出现负数，当前 focusMins=%d", snapshot3.TodayFocusMinutes)
	}
}

func TestStatsAggregator_RestAndOffDuty(t *testing.T) {
	agg := NewStatsAggregator("2026-11-06")

	// 累加 600 秒休息
	agg.AddRest(600)
	agg.IncrementRestCount()

	snap := agg.GetStatsSnapshot("away")
	if snap.TodayRestMinutes != 10 || snap.RestCount != 1 {
		t.Fatalf("休息统计异常: restMins=%d, count=%d", snap.TodayRestMinutes, snap.RestCount)
	}

	// 触发午休判定，剔除这 600 秒离座休息
	agg.RollbackRest(600)
	snap2 := agg.GetStatsSnapshot("offduty")
	if snap2.TodayRestMinutes != 0 {
		t.Fatalf("午休剔除后休息时长应为 0，实际为: %d", snap2.TodayRestMinutes)
	}
}

func TestStatsAggregator_DayReset(t *testing.T) {
	agg := NewStatsAggregator("2026-11-06")
	agg.AddFocus(3600, 10)
	agg.AddRest(600)
	agg.IncrementRestCount()

	// 传入同一天，不应触发重置
	isReset, _ := agg.CheckDayReset(time.Date(2026, 11, 6, 23, 59, 59, 0, time.Local))
	if isReset {
		t.Fatalf("同一天不应重置")
	}

	// 传入次日 0 点，应触发跨天重置并归档昨日数据
	nextDay := time.Date(2026, 11, 7, 0, 0, 1, 0, time.Local)
	isReset2, oldData := agg.CheckDayReset(nextDay)
	if !isReset2 {
		t.Fatalf("次日应当触发重置")
	}
	if oldData.FocusSeconds != 3600 || oldData.Date != "2026-11-06" {
		t.Fatalf("归档昨日数据异常: %+v", oldData)
	}

	// 新一天的统计应当清零
	snap := agg.GetStatsSnapshot("working")
	if snap.TodayFocusMinutes != 0 || snap.TodayRestMinutes != 0 || snap.RestCount != 0 {
		t.Fatalf("新一天统计未清零: %+v", snap)
	}
}
