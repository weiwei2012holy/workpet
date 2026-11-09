/**
 * @Author wei
 * @Date 2026-11-09
 * @Description 全局配置与窗口位置持久化管理模块，负责读写 ~/.workpet/config.json，包含小组件与工具启闭状态及午休/下班长时间离座阈值
 **/

package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// GetWorkPetDir 获取统一的 WorkPet 应用数据根目录 (~/.workpet)
func GetWorkPetDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	dir := filepath.Join(homeDir, ".workpet")
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("[Config] 确保数据根目录失败: %v", err)
	}
	return dir
}

// AppConfig 保存用户的偏好设置、窗口坐标与工具箱配置
type AppConfig struct {
	WindowX          int      `json:"windowX"`
	WindowY          int      `json:"windowY"`
	HasSavedPos      bool     `json:"hasSavedPos"`
	IntervalMins     int      `json:"intervalMins"`
	IdleThreshold    int      `json:"idleThreshold"`
	OffDutyThreshold int      `json:"offDutyThreshold"` // 判定午休/下班的长时间休息阈值（分钟，默认 30）
	Autostart        bool     `json:"autostart"`
	AutoHideWidget   bool     `json:"autoHideWidget"`
	EnabledTools     []string `json:"enabledTools"`
	DashboardWidgets []string `json:"dashboardWidgets"`
}

// ConfigManager 负责配置的读取与安全写入（支持高频位置写入防抖）
type ConfigManager struct {
	mu         sync.Mutex
	filePath   string
	config     AppConfig
	posTimer   *time.Timer
	pendingPos bool
}

// NewConfigManager 初始化配置管理器并加载历史配置
func NewConfigManager() *ConfigManager {
	configDir := GetWorkPetDir()
	configFile := filepath.Join(configDir, "config.json")

	cm := &ConfigManager{
		filePath: configFile,
		config: AppConfig{
			HasSavedPos:      false,
			IntervalMins:     30,
			IdleThreshold:    3,
			OffDutyThreshold: 30, // 默认 30 分钟连续离座判定为午休或下班
			Autostart:        false,
			AutoHideWidget:   false, // 默认桌面常驻，避免点击或失焦时意外消失
			EnabledTools:     []string{"activity", "datetime"},
			DashboardWidgets: []string{
				"activity-timer",
				"activity-focus-today",
				"activity-rest-today",
				"activity-trend",
				"activity-status",
			},
		},
	}

	cm.load()
	return cm
}

// load 从本地文件加载配置
func (cm *ConfigManager) load() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	data, err := os.ReadFile(cm.filePath)
	if err != nil {
		return
	}

	var loaded AppConfig
	if err := json.Unmarshal(data, &loaded); err == nil {
		cm.config.WindowX = loaded.WindowX
		cm.config.WindowY = loaded.WindowY
		cm.config.HasSavedPos = loaded.HasSavedPos

		if loaded.IntervalMins > 0 {
			cm.config.IntervalMins = loaded.IntervalMins
		}
		if loaded.IdleThreshold > 0 {
			cm.config.IdleThreshold = loaded.IdleThreshold
		}
		if loaded.OffDutyThreshold > 0 {
			cm.config.OffDutyThreshold = loaded.OffDutyThreshold
		} else {
			cm.config.OffDutyThreshold = 30
		}
		cm.config.Autostart = loaded.Autostart
		cm.config.AutoHideWidget = loaded.AutoHideWidget

		if len(loaded.EnabledTools) > 0 {
			cm.config.EnabledTools = loaded.EnabledTools
		}
		if len(loaded.DashboardWidgets) > 0 {
			cm.config.DashboardWidgets = loaded.DashboardWidgets
		}
	}
}

// saveLocked 将当前配置写入磁盘（需在加锁状态下调用）
func (cm *ConfigManager) saveLocked() {
	data, err := json.MarshalIndent(cm.config, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(cm.filePath, data, 0644)
}

// GetConfig 获取当前配置副本
func (cm *ConfigManager) GetConfig() AppConfig {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	return cm.config
}

// SavePosition 保存窗口位置坐标（带 600ms 定时器防抖，避免拖动窗口产生高频磁盘 IO）
func (cm *ConfigManager) SavePosition(x, y int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.WindowX = x
	cm.config.WindowY = y
	cm.config.HasSavedPos = true
	cm.pendingPos = true

	if cm.posTimer != nil {
		cm.posTimer.Stop()
	}

	cm.posTimer = time.AfterFunc(600*time.Millisecond, func() {
		cm.mu.Lock()
		defer cm.mu.Unlock()
		if cm.pendingPos {
			cm.saveLocked()
			cm.pendingPos = false
		}
	})
}

// Flush 立即将未完成的内存改动同步刷写到磁盘
func (cm *ConfigManager) Flush() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.posTimer != nil {
		cm.posTimer.Stop()
	}
	if cm.pendingPos {
		cm.saveLocked()
		cm.pendingPos = false
	}
}

// SaveInterval 保存专注时长设置
func (cm *ConfigManager) SaveInterval(mins int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.IntervalMins = mins
	cm.saveLocked()
}

// SaveIdleThreshold 保存空闲感知阈值
func (cm *ConfigManager) SaveIdleThreshold(mins int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.IdleThreshold = mins
	cm.saveLocked()
}

// SaveOffDutyThreshold 保存午休/下班判定阈值（单位：分钟）
func (cm *ConfigManager) SaveOffDutyThreshold(mins int) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.OffDutyThreshold = mins
	cm.saveLocked()
}

// SetAutostart 设置并持久化开机自启
func (cm *ConfigManager) SetAutostart(enabled bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.Autostart = enabled
	cm.saveLocked()
}

// SetAutoHideWidget 设置并持久化失焦隐藏
func (cm *ConfigManager) SetAutoHideWidget(enabled bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.AutoHideWidget = enabled
	cm.saveLocked()
}

// SetToolEnabled 开启或禁用指定工具插件
func (cm *ConfigManager) SetToolEnabled(toolID string, enabled bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	newTools := make([]string, 0, len(cm.config.EnabledTools)+1)
	for _, id := range cm.config.EnabledTools {
		if id != toolID {
			newTools = append(newTools, id)
		}
	}
	if enabled {
		newTools = append(newTools, toolID)
	}
	cm.config.EnabledTools = newTools
	cm.saveLocked()
}

// SaveDashboardWidgets 保存用户当前看板的小组件 ID 顺序列表
func (cm *ConfigManager) SaveDashboardWidgets(widgets []string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config.DashboardWidgets = widgets
	cm.saveLocked()
}
