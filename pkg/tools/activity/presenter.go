/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 状态栏与托盘文案表现层（TrayPresenter），纯函数实现，避免污染核心业务逻辑
 **/

package activity

import (
	"fmt"
)

// FormatTrayLabel 根据当前提醒与专注状态生成顶部状态栏托盘文本
func FormatTrayLabel(state ReminderState) string {
	if state.IsAway {
		if state.IsOffDuty {
			return "🌙 午休/下班中"
		}
		return "😴 离座休息中"
	}
	if state.IsReminding {
		return "🚨 该活动啦!"
	}
	if state.IsPaused {
		return "⏸ 休息中"
	}

	mins := state.RemainingSeconds / 60
	secs := state.RemainingSeconds % 60
	return fmt.Sprintf("⏳ %02d:%02d", mins, secs)
}
