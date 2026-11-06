/**
 * @Author wei
 * @Date 2026-11-03
 * @Description 其他未适配系统兜底空闲检测桩
 **/

//go:build !darwin && !windows

package idle

func getPlatformIdleTime() float64 {
	return 0
}
