/**
 * @Author wei
 * @Date 2026-11-09
 * @Description 应用程序主入口，负责装配系统级通用特性（单实例互斥、随行挂件、无边框控制看板双窗口、系统托盘、Dock 栏常驻、开机自启）与各工具插件
 **/

package main

import (
	"embed"
	"log"

	"workpet/pkg/config"
	"workpet/pkg/storage"
	"workpet/pkg/system"
	"workpet/pkg/tools/activity"
	"workpet/pkg/updater"
	"workpet/pkg/version"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Wails 打包前端资源与应用图标
//
//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIconBytes []byte

// 全局唤出/收起挂件快捷键
const toggleShortcut = "CmdOrCtrl+Shift+R"

func main() {
	// 1. 初始化通用配置管理器 (~/.workpet/config.json)
	configMgr := config.NewConfigManager()
	cfg := configMgr.GetConfig()

	// 2. 初始化核心嵌入式数据库存储 (~/.workpet/workpet.db)
	storageDB, err := storage.InitDB()
	if err != nil {
		log.Printf("初始化数据库失败: %v", err)
	} else {
		defer storageDB.Close()
	}

	// 3. 初始化核心服务与已注册工具插件服务
	systemService := system.NewService(configMgr, toggleShortcut)
	activityService := activity.NewService(configMgr, storageDB)
	updateService := updater.NewService(version.GetShortVersion(), "weiwei2012holy/workpet")

	// 3. 初始化 Wails 应用程序内核
	app := application.New(application.Options{
		Name:        "workpet",
		Description: "桌面灵动悬浮挂件与效率指标看板工具箱",
		Services: []application.Service{
			application.NewService(activityService),
			application.NewService(systemService),
			application.NewService(updateService),
		},
		Mac: application.MacOptions{
			ActivationPolicy:                                application.ActivationPolicyRegular,
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
		Windows: application.WindowsOptions{
			DisableQuitOnLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.workpet.desktop",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				// 当已有实例运行时，再次启动自动激活并置顶已有界面，避免重复启动冲突
				systemService.OpenDashboard()
				activityService.ShowWindow()
			},
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	// 4. 构建桌面随行悬浮挂件 (遵循 Wails 官方 Frameless 标准方案：356x58 精确物理贴合，macOS 原生圆角与系统阴影)
	floatOpts := application.WebviewWindowOptions{
		Name:             "workpet-floating-widget",
		Title:            "WorkPet 挂件",
		Width:            356,
		Height:           58,
		AlwaysOnTop:      true,
		Frameless:        true,
		DisableResize:    true,
		URL:              "/?window=widget",
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		KeyBindings: map[string]func(window application.Window){
			"CmdOrCtrl+q": func(window application.Window) {
				activityService.Quit()
			},
			"CmdOrCtrl+w": func(window application.Window) {
				activityService.HideWindow()
			},
		},
		Mac: application.MacWindow{
			Backdrop:      application.MacBackdropTransparent,
			CornerType:    application.MacWindowCornerTypeRounded,
			CornerRadius:  18,
			DisableShadow: false, // 启用 macOS 原生硬件级窗口阴影，绝无 CSS 视口截断方框
			WindowLevel:   application.MacWindowLevelFloating,
			CollectionBehavior: application.MacWindowCollectionBehaviorCanJoinAllSpaces |
				application.MacWindowCollectionBehaviorStationary,
		},
		Windows: application.WindowsWindow{
			BackdropType:                      application.Acrylic,
			DisableFramelessWindowDecorations: false,
		},
	}

	if cfg.HasSavedPos {
		floatOpts.InitialPosition = application.WindowXY
		floatOpts.X = cfg.WindowX
		floatOpts.Y = cfg.WindowY
	} else {
		floatOpts.InitialPosition = application.WindowCentered
	}

	floatWindow := app.Window.NewWithOptions(floatOpts)

	// 挂载随行挂件事件监听：自动记忆屏幕位置与失焦收起
	floatWindow.OnWindowEvent(events.Common.WindowDidMove, func(event *application.WindowEvent) {
		x, y := floatWindow.Position()
		configMgr.SavePosition(x, y)
	})

	floatWindow.OnWindowEvent(events.Common.WindowLostFocus, func(event *application.WindowEvent) {
		activityService.OnWindowLostFocus()
	})

	floatWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		configMgr.Flush()
		floatWindow.Hide()
		e.Cancel()
	})

	// 5. 构建主控制看板大窗口 (1040x680, 无边框沉浸式毛玻璃窗口，纯深空宇宙黑)
	dashOpts := application.WebviewWindowOptions{
		Name:             "workpet-dashboard",
		Title:            "WorkPet 控制中心",
		Width:            1040,
		Height:           680,
		Frameless:        true,
		DisableResize:    false,
		InitialPosition:  application.WindowCentered,
		URL:              "/?window=dashboard",
		Hidden:           true, // 启动初始隐藏
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		KeyBindings: map[string]func(window application.Window){
			"CmdOrCtrl+w": func(window application.Window) {
				systemService.CloseDashboard()
			},
			"CmdOrCtrl+q": func(window application.Window) {
				systemService.Quit()
			},
		},
		Mac: application.MacWindow{
			Backdrop:      application.MacBackdropTranslucent,
			CornerType:    application.MacWindowCornerTypeRounded,
			CornerRadius:  18,
			DisableShadow: false,
		},
		Windows: application.WindowsWindow{
			BackdropType:                      application.Acrylic,
			DisableFramelessWindowDecorations: false,
		},
	}

	dashboardWindow := app.Window.NewWithOptions(dashOpts)

	// 看板窗口拦截关闭事件：仅隐藏而不销毁
	dashboardWindow.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		dashboardWindow.Hide()
		e.Cancel()
	})

	// 6. 初始化系统托盘（点击菜单栏倒计时按钮默认切换打开控制看板）
	tray := app.SystemTray.New()
	tray.SetLabel("⏳ 30:00")
	tray.OnClick(func() {
		systemService.ToggleDashboard()
	})

	trayMenu := application.NewMenu()
	trayMenu.Add("📊 打开控制看板 (Dashboard)").OnClick(func(ctx *application.Context) {
		systemService.OpenDashboard()
	})
	trayMenu.Add("🪟 显示/隐藏挂件 (" + toggleShortcut + ")").OnClick(func(ctx *application.Context) {
		activityService.ToggleWindow()
	})
	trayMenu.AddSeparator()
	trayMenu.Add("✅ 已活动 (重置计时)").OnClick(func(ctx *application.Context) {
		activityService.AcknowledgeRest()
	})
	trayMenu.Add("💤 稍后提醒 (+5分钟)").OnClick(func(ctx *application.Context) {
		activityService.Snooze(5)
	})
	trayMenu.AddSeparator()
	trayMenu.Add("设置间隔: 15 分钟").OnClick(func(ctx *application.Context) {
		activityService.SetInterval(15)
	})
	trayMenu.Add("设置间隔: 30 分钟").OnClick(func(ctx *application.Context) {
		activityService.SetInterval(30)
	})
	trayMenu.Add("设置间隔: 45 分钟").OnClick(func(ctx *application.Context) {
		activityService.SetInterval(45)
	})
	trayMenu.Add("设置间隔: 60 分钟").OnClick(func(ctx *application.Context) {
		activityService.SetInterval(60)
	})
	trayMenu.AddSeparator()
	trayMenu.Add("🔄 检查更新...").OnClick(func(ctx *application.Context) {
		systemService.OpenDashboard()
		go func() {
			_, _ = updateService.CheckForUpdate()
		}()
	})
	trayMenu.AddSeparator()
	trayMenu.Add("退出 WorkPet (Quit)").SetAccelerator("CmdOrCtrl+Q").OnClick(func(ctx *application.Context) {
		configMgr.Flush()
		activityService.Quit()
	})
	tray.SetMenu(trayMenu)

	// 7. 组装原生主菜单
	mainAppMenu := application.NewMenu()
	appSubMenu := mainAppMenu.AddSubmenu("WorkPet")
	appSubMenu.Add("关于 WorkPet").OnClick(func(ctx *application.Context) {
		systemService.OpenDashboard()
	})
	appSubMenu.Add("检查更新...").OnClick(func(ctx *application.Context) {
		systemService.OpenDashboard()
		go func() {
			_, _ = updateService.CheckForUpdate()
		}()
	})
	appSubMenu.AddSeparator()
	appSubMenu.Add("控制看板").OnClick(func(ctx *application.Context) {
		systemService.OpenDashboard()
	})
	appSubMenu.Add("显示/隐藏挂件 (" + toggleShortcut + ")").OnClick(func(ctx *application.Context) {
		activityService.ToggleWindow()
	})
	appSubMenu.AddSeparator()
	appSubMenu.AddRole(application.Quit)

	// 必须添加 EditMenu 标准编辑角色（在 macOS 下系统由 NSMenu 路由快捷键，缺少 Edit 菜单会导致 Cmd+C / Cmd+V / Cmd+A / Cmd+X / Cmd+Z 等快捷键在所有 WebView 输入框中失效）
	mainAppMenu.AddRole(application.EditMenu)

	app.Menu.SetApplicationMenu(mainAppMenu)

	// 8. 绑定工具服务与系统服务
	activityService.BindApp(app, floatWindow, dashboardWindow, tray)
	systemService.BindApp(app, floatWindow, dashboardWindow)
	updateService.SetApp(app)

	// 注册 Dock 栏点击事件：点击 Dock 栏常驻图标时唤出并激活控制看板
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(event *application.ApplicationEvent) {
		systemService.OpenDashboard()
	})

	// 动态设置 macOS 应用与 Dock 栏图标（确保无论系统 LaunchServices 缓存如何均立即生效）
	app.Event.OnApplicationEvent(events.Mac.ApplicationDidFinishLaunching, func(event *application.ApplicationEvent) {
		if len(appIconBytes) > 0 {
			app.SetIcon(appIconBytes)
		}
	})

	// 注册全局热键
	if err := app.GlobalShortcut.Register(toggleShortcut, func() {
		activityService.ToggleWindow()
	}); err != nil {
		log.Printf("注册快捷键 %s 失败: %v", toggleShortcut, err)
	}

	floatWindow.Show()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
