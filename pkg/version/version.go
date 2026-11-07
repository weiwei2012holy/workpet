/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 统一全局版本号定义模块（Single Source of Truth），支持 CI 构建时通过 -ldflags 动态注入 Git Tag
 **/

package version

import "strings"

// Version 全局应用程序版本号。
// 默认版本为开发态版本，CI/CD 在发布 Git Tag 时会通过以下参数动态注入：
// -ldflags "-X workpet/pkg/version.Version=${TAG}"
var Version = "v0.1.2"

// GetVersion 获取标准语义化版本号字符串（如 "v0.0.3"）
func GetVersion() string {
	if Version == "" {
		return "v0.0.0-dev"
	}
	return Version
}

// GetShortVersion 获取纯数字版本号字符串（如 "0.1.0"），供 Wails Updater semver 解析使用
func GetShortVersion() string {
	v := GetVersion()
	return strings.TrimPrefix(v, "v")
}
