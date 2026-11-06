/**
 * @Author wei
 * @Date 2026-11-03
 * @Description 跨平台物理空闲时间感知服务公共接口
 **/

package idle

// GetSystemIdleTime 获取系统自上次键盘/鼠标操作以来的物理空闲秒数
// 在 macOS 下使用 CoreGraphics，在 Windows 下使用 user32.dll，其余平台兜底返回 0
func GetSystemIdleTime() float64 {
	return getPlatformIdleTime()
}
