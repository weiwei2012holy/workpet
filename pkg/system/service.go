/**
 * @Author wei
 * @Date 2026-11-04
 * @Description 系统级控制与全局配置服务，负责开机自启、多窗口调度（无边框最小化/隐藏）、工具箱启闭与看板配置
 **/

package system

import (
	"log"
	"sync"

	"workpet/pkg/config"
	"workpet/pkg/version"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppSettings 系统全局设置模型（暴露给前端 Settings 页面）
type AppSettings struct {
	Autostart        bool     `json:"autostart"`
	AutostartStatus  bool     `json:"autostartStatus"` // 系统实际生效状态
	AutoHideWidget   bool     `json:"autoHideWidget"`
	GlobalShortcut   string   `json:"globalShortcut"`
	EnabledTools     []string `json:"enabledTools"`
	DashboardWidgets []string `json:"dashboardWidgets"`
	AppVersion       string   `json:"appVersion"`
}

// Service 系统综合服务
type Service struct {
	mu              sync.RWMutex
	app             *application.App
	configMgr       *config.ConfigManager
	dashboardWindow *application.WebviewWindow
	floatingWindow  *application.WebviewWindow
	globalShortcut  string
}

// NewService 创建系统综合服务
func NewService(configMgr *config.ConfigManager, globalShortcut string) *Service {
	return &Service{
		configMgr:      configMgr,
		globalShortcut: globalShortcut,
	}
}

// BindApp 关联 Wails 应用程序实例与窗口句柄
func (s *Service) BindApp(app *application.App, floatingWindow *application.WebviewWindow, dashboardWindow *application.WebviewWindow) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.app = app
	s.floatingWindow = floatingWindow
	s.dashboardWindow = dashboardWindow
}

// GetAppSettings 获取系统当前配置与运行状态
func (s *Service) GetAppSettings() AppSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()

	cfg := s.configMgr.GetConfig()
	actualAutostart := false

	if s.app != nil {
		if st, err := s.app.Autostart.Status(); err == nil {
			actualAutostart = st.Enabled
		}
	}

	return AppSettings{
		Autostart:        cfg.Autostart,
		AutostartStatus:  actualAutostart,
		AutoHideWidget:   cfg.AutoHideWidget,
		GlobalShortcut:   s.globalShortcut,
		EnabledTools:     cfg.EnabledTools,
		DashboardWidgets: cfg.DashboardWidgets,
		AppVersion:       version.GetVersion(),
	}
}

// GetAppVersion 获取当前系统版本号
func (s *Service) GetAppVersion() string {
	return version.GetVersion()
}

// SetAutostart 设置系统开机自启
func (s *Service) SetAutostart(enabled bool) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.app != nil {
		if enabled {
			if err := s.app.Autostart.Enable(); err != nil {
				log.Printf("启用开机自启失败: %v", err)
				return false, err
			}
		} else {
			if err := s.app.Autostart.Disable(); err != nil {
				log.Printf("关闭开机自启失败: %v", err)
				return false, err
			}
		}
	}

	s.configMgr.SetAutostart(enabled)
	return enabled, nil
}

// SetAutoHideWidget 设置挂件失焦自动收起
func (s *Service) SetAutoHideWidget(enabled bool) {
	s.configMgr.SetAutoHideWidget(enabled)
}

// ToolChangeNotification 工具启闭变动事件统一载荷
type ToolChangeNotification struct {
	ToolID  string `json:"toolId"`
	Enabled bool   `json:"enabled"`
}

// SetToolEnabled 启用或禁用某个工具
func (s *Service) SetToolEnabled(toolID string, enabled bool) {
	s.configMgr.SetToolEnabled(toolID, enabled)
	if s.app != nil {
		s.app.Event.Emit("settings:tools-changed", ToolChangeNotification{
			ToolID:  toolID,
			Enabled: enabled,
		})
	}
}

// SaveDashboardWidgets 保存用户当前看板的小组件配置
func (s *Service) SaveDashboardWidgets(widgets []string) {
	s.configMgr.SaveDashboardWidgets(widgets)
	if s.app != nil {
		s.app.Event.Emit("settings:dashboard-widgets-changed", widgets)
	}
}

// OpenDashboard 打开/置顶主控制看板大窗口
func (s *Service) OpenDashboard() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.dashboardWindow != nil {
		s.dashboardWindow.Show()
		s.dashboardWindow.Focus()
	}
}

// CloseDashboard 隐藏主控制看板
func (s *Service) CloseDashboard() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.dashboardWindow != nil {
		s.dashboardWindow.Hide()
	}
}

// MinimizeDashboard 最小化主控制看板
func (s *Service) MinimizeDashboard() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.dashboardWindow != nil {
		s.dashboardWindow.Minimise()
	}
}

// ToggleDashboard 切换主控制看板显示状态
func (s *Service) ToggleDashboard() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.dashboardWindow != nil {
		if s.dashboardWindow.IsVisible() {
			s.dashboardWindow.Hide()
		} else {
			s.dashboardWindow.Show()
			s.dashboardWindow.Focus()
		}
	}
}

// OpenWidget 打开随行悬浮挂件
func (s *Service) OpenWidget() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.floatingWindow != nil {
		s.floatingWindow.Show()
		s.floatingWindow.Focus()
	}
	if s.app != nil {
		s.app.Event.Emit("reminder:window-shown", nil)
	}
}

// CloseWidget 隐藏随行悬浮挂件
func (s *Service) CloseWidget() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.floatingWindow != nil {
		s.floatingWindow.Hide()
	}
}

// Quit 退出应用程序
func (s *Service) Quit() {
	if s.app != nil {
		s.app.Quit()
	}
}
