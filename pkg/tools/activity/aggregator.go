/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 活动与专注度日度累计与小时走势聚合器（StatsAggregator），支持增量统计、离座精准回冲与跨天安全归档
 **/

package activity

import (
	"sync"
	"time"

	"workpet/pkg/storage"
)

// StatsAggregator 负责日/小时专注与休息时长的统计累加与回冲计算（纯逻辑，可独立单测）
type StatsAggregator struct {
	mu                 sync.RWMutex
	todayDate          string
	todayFocusSeconds  int
	todayRestSeconds   int
	restCount          int
	hourlyFocusSeconds [24]int
}

// NewStatsAggregator 创建统计聚合器
func NewStatsAggregator(initialDate string) *StatsAggregator {
	if initialDate == "" {
		initialDate = time.Now().Format("2006-01-02")
	}
	return &StatsAggregator{
		todayDate: initialDate,
	}
}

// CheckDayReset 检查是否跨天，如果跨天则重置今日计数并返回 true（供调用方归档上一日数据）
func (a *StatsAggregator) CheckDayReset(now time.Time) (bool, storage.DailyActivity) {
	a.mu.Lock()
	defer a.mu.Unlock()

	todayStr := now.Format("2006-01-02")
	if todayStr != a.todayDate {
		oldData := storage.DailyActivity{
			Date:               a.todayDate,
			FocusSeconds:       a.todayFocusSeconds,
			RestSeconds:        a.todayRestSeconds,
			RestCount:          a.restCount,
			HourlyFocusSeconds: a.hourlyFocusSeconds,
			UpdatedAt:          now.Format("2006-01-02 15:04:05"),
		}

		// 重置为新一天
		a.todayDate = todayStr
		a.todayFocusSeconds = 0
		a.todayRestSeconds = 0
		a.restCount = 0
		a.hourlyFocusSeconds = [24]int{}
		return true, oldData
	}
	return false, storage.DailyActivity{}
}

// AddFocus 累加专注时长（同时累加当日总秒数与对应小时桶）
func (a *StatsAggregator) AddFocus(seconds int, hour int) {
	if seconds <= 0 {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	a.todayFocusSeconds += seconds
	if hour >= 0 && hour < 24 {
		a.hourlyFocusSeconds[hour] += seconds
	}
}

// RollbackFocus 从专注时长中回冲扣减（用于判定离座后消除离座前误算的专注时长）
func (a *StatsAggregator) RollbackFocus(seconds int, hour int) int {
	if seconds <= 0 {
		return 0
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	actualRollback := seconds
	if actualRollback > a.todayFocusSeconds {
		actualRollback = a.todayFocusSeconds
	}
	a.todayFocusSeconds -= actualRollback

	if hour >= 0 && hour < 24 {
		a.hourlyFocusSeconds[hour] -= actualRollback
		if a.hourlyFocusSeconds[hour] < 0 {
			a.hourlyFocusSeconds[hour] = 0
		}
	}
	return actualRollback
}

// AddRest 累加休息时长
func (a *StatsAggregator) AddRest(seconds int) {
	if seconds <= 0 {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	a.todayRestSeconds += seconds
}

// RollbackRest 扣减休息时长（用于长时间离座后自动判定为午休/下班，剔除休息累计）
func (a *StatsAggregator) RollbackRest(seconds int) {
	if seconds <= 0 {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	a.todayRestSeconds -= seconds
	if a.todayRestSeconds < 0 {
		a.todayRestSeconds = 0
	}
}

// IncrementRestCount 递增工间休息完成次数
func (a *StatsAggregator) IncrementRestCount() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.restCount++
}

// RestoreFromStorage 从数据库历史记录中恢复数据状态
func (a *StatsAggregator) RestoreFromStorage(data *storage.DailyActivity) {
	if data == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	a.todayDate = data.Date
	a.todayFocusSeconds = data.FocusSeconds
	a.todayRestSeconds = data.RestSeconds
	a.restCount = data.RestCount
	a.hourlyFocusSeconds = data.HourlyFocusSeconds
}

// ToDailyActivity 转换为存储模型
func (a *StatsAggregator) ToDailyActivity() storage.DailyActivity {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return storage.DailyActivity{
		Date:               a.todayDate,
		FocusSeconds:       a.todayFocusSeconds,
		RestSeconds:        a.todayRestSeconds,
		RestCount:          a.restCount,
		HourlyFocusSeconds: a.hourlyFocusSeconds,
		UpdatedAt:          time.Now().Format("2006-01-02 15:04:05"),
	}
}

// GetStatsSnapshot 获取当前统计快照（供前端视图展示）
func (a *StatsAggregator) GetStatsSnapshot(currentState string) ActivityStats {
	a.mu.RLock()
	defer a.mu.RUnlock()

	focusMins := a.todayFocusSeconds / 60
	restMins := a.todayRestSeconds / 60

	var hourlyMins [24]int
	for i := 0; i < 24; i++ {
		hourlyMins[i] = a.hourlyFocusSeconds[i] / 60
	}

	return ActivityStats{
		TodayFocusMinutes: focusMins,
		TodayRestMinutes:  restMins,
		RestCount:         a.restCount,
		CurrentState:      currentState,
		HourlyFocus:       hourlyMins,
		TodayDate:         a.todayDate,
	}
}
