/**
 * @Author wei
 * @Date 2026-11-11
 * @Description 基于 GitHub Releases 的应用自更新服务模块，接入 Wails v3 原生 Updater 状态机，配置 Headless 模式杜绝无更新时弹窗打扰
 **/

package updater

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailsUpdater "github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/endpoint"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

// UpdateInfo 传递给前端的更新信息数据模型
type UpdateInfo struct {
	CurrentVersion string  `json:"currentVersion"`
	HasUpdate      bool    `json:"hasUpdate"`
	LatestVersion  string  `json:"latestVersion"`
	ReleaseName    string  `json:"releaseName"`
	ReleaseNotes   string  `json:"releaseNotes"`
	PublishedAt    string  `json:"publishedAt"`
	ArtifactName   string  `json:"artifactName"`
	ArtifactSize   int64   `json:"artifactSize"`
	State          string  `json:"state"` // idle, checking, available, downloading, ready, error
	Progress       float64 `json:"progress"` // 0.0 ~ 100.0
	BytesWritten   int64   `json:"bytesWritten"`
	TotalBytes     int64   `json:"totalBytes"`
	DownloadRate   float64 `json:"downloadRate"` // bytes/sec
	ErrorMessage   string  `json:"errorMessage,omitempty"`
}

// Service 自更新业务服务
type Service struct {
	mu             sync.RWMutex
	app            *application.App
	currentVersion string
	githubRepo     string
	provider       *github.Provider

	lastInfo *UpdateInfo
}

// NewService 创建更新服务实例
func NewService(currentVersion string, githubRepo string) *Service {
	s := &Service{
		currentVersion: currentVersion,
		githubRepo:     githubRepo,
		lastInfo: &UpdateInfo{
			CurrentVersion: currentVersion,
			State:          "idle",
		},
	}
	return s
}

// SetApp 注入 Wails 宿主 App 实例并完成 Updater 初始化与生命周期事件绑定
func (s *Service) SetApp(app *application.App) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.app = app

	if app == nil {
		return
	}

	// 1. 初始化基于 Wails Update Manifest 协议的签名更新源（直接校验 Ed25519 签名，且走静态直链完全免 API 限流）
	manifestURL := fmt.Sprintf("https://github.com/%s/releases/latest/download/manifest.json", s.githubRepo)
	manifestProvider, err := endpoint.New(endpoint.Config{
		URL: manifestURL,
	})
	if err != nil {
		log.Printf("[Updater] 初始化 Manifest Provider 失败: %v", err)
	}

	// 2. 初始化 GitHub Release 原生 API Provider（备用更新源）
	provider, err := github.New(github.Config{
		Repository:    s.githubRepo,
		AssetMatcher:  customAssetMatcher,
		ChecksumAsset: "SHA256SUMS",
	})
	if err != nil {
		log.Printf("[Updater] 初始化 GitHub Provider 失败: %v", err)
	}
	s.provider = provider

	// 3. 初始化 GitHub Web 免限流兜底更新源
	webFallback := NewWebFallbackProvider(s.githubRepo)

	var providers []wailsUpdater.Provider
	if manifestProvider != nil {
		providers = append(providers, manifestProvider)
	}
	if provider != nil {
		providers = append(providers, provider)
	}
	providers = append(providers, webFallback)

	// 4. 将 Provider 注册给 Wails v3 原生 Updater，启用内嵌公钥强验证（Fail-Closed 模式）
	// 并显式配置 Window: WindowNone，使用 Headless 模式完全接入应用自身的前端 UI，彻底禁止弹窗
	err = app.Updater.Init(wailsUpdater.Config{
		CurrentVersion: s.currentVersion,
		Providers:      providers,
		CheckInterval:  6 * time.Hour,          // 每 6 小时后台静默轮询一次
		PublicKey:      UpdaterPublicKey,      // 🔒 注入 Ed25519 信任根，杜绝任何无签名或伪造更新
		Window:         wailsUpdater.WindowNone, // 彻底禁止 Wails 自带的 Software Update 原生弹窗 (无更新时绝对静默)
	})
	if err != nil && err != wailsUpdater.ErrAlreadyConfigured {
		log.Printf("[Updater] 初始化 Wails Updater 引擎失败: %v", err)
		return
	}

	// 3. 监听 Wails Updater 状态机生命周期事件，同步状态并向前端 Webview 广播
	app.Event.On(wailsUpdater.EventCheckStarted, func(evt *application.CustomEvent) {
		s.mu.Lock()
		s.lastInfo.State = "checking"
		s.lastInfo.ErrorMessage = ""
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})

	app.Event.On(wailsUpdater.EventNoUpdate, func(evt *application.CustomEvent) {
		s.mu.Lock()
		s.lastInfo.State = "idle"
		s.lastInfo.HasUpdate = false
		s.lastInfo.ErrorMessage = ""
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})

	app.Event.On(wailsUpdater.EventUpdateAvailable, func(evt *application.CustomEvent) {
		s.mu.Lock()
		rel, _ := evt.Data.(*wailsUpdater.Release)
		s.lastInfo.State = "available"
		s.lastInfo.HasUpdate = true
		if rel != nil {
			s.lastInfo.LatestVersion = rel.Version
			s.lastInfo.ReleaseName = rel.Name
			s.lastInfo.ReleaseNotes = rel.Notes
			s.lastInfo.PublishedAt = rel.PublishedAt.Format("2006-01-02 15:04")
			s.lastInfo.ArtifactName = rel.Artifact.Filename
			s.lastInfo.ArtifactSize = rel.Artifact.Size
		}
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})

	app.Event.On(wailsUpdater.EventDownloadProgress, func(evt *application.CustomEvent) {
		s.mu.Lock()
		prog, ok := evt.Data.(wailsUpdater.Progress)
		if ok {
			s.lastInfo.State = "downloading"
			s.lastInfo.BytesWritten = prog.Written
			s.lastInfo.TotalBytes = prog.Total
			s.lastInfo.DownloadRate = prog.Rate
			if prog.Total > 0 {
				s.lastInfo.Progress = float64(prog.Written) / float64(prog.Total) * 100.0
			}
		}
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})

	app.Event.On(wailsUpdater.EventUpdateReady, func(evt *application.CustomEvent) {
		s.mu.Lock()
		s.lastInfo.State = "ready"
		s.lastInfo.Progress = 100.0
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})

	app.Event.On(wailsUpdater.EventError, func(evt *application.CustomEvent) {
		s.mu.Lock()
		s.lastInfo.State = "error"
		if errInfo, ok := evt.Data.(wailsUpdater.ErrorInfo); ok {
			s.lastInfo.ErrorMessage = fmt.Sprintf("[%s] %s", errInfo.Stage, errInfo.Message)
		} else {
			s.lastInfo.ErrorMessage = "更新过程发生未知异常"
		}
		info := *s.lastInfo
		s.mu.Unlock()
		app.Event.Emit("workpet:updater:status", info)
	})
}

// CheckForUpdate 手动检查 GitHub Releases 最新版本
func (s *Service) CheckForUpdate() (*UpdateInfo, error) {
	s.mu.RLock()
	app := s.app
	s.mu.RUnlock()

	if app == nil || app.Updater == nil {
		return nil, fmt.Errorf("更新器尚未就绪")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	s.mu.Lock()
	if s.lastInfo.State == "checking" {
		info := *s.lastInfo
		s.mu.Unlock()
		return &info, nil
	}
	s.lastInfo.State = "checking"
	s.lastInfo.ErrorMessage = ""
	s.mu.Unlock()

	rel, err := app.Updater.Check(ctx)
	if err != nil {
		s.mu.Lock()
		s.lastInfo.State = "error"
		rawErr := err.Error()
		if strings.Contains(rawErr, "rate limit") || strings.Contains(rawErr, "403") {
			s.lastInfo.ErrorMessage = "GitHub 访问频次暂时受限，请稍候重试"
		} else {
			s.lastInfo.ErrorMessage = rawErr
		}
		result := *s.lastInfo
		s.mu.Unlock()
		return &result, fmt.Errorf("%s", s.lastInfo.ErrorMessage)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if rel == nil {
		s.lastInfo.State = "idle"
		s.lastInfo.HasUpdate = false
	} else {
		s.lastInfo.State = "available"
		s.lastInfo.HasUpdate = true
		s.lastInfo.LatestVersion = rel.Version
		s.lastInfo.ReleaseName = rel.Name
		s.lastInfo.ReleaseNotes = rel.Notes
		s.lastInfo.PublishedAt = rel.PublishedAt.Format("2006-01-02 15:04")
		s.lastInfo.ArtifactName = rel.Artifact.Filename
		s.lastInfo.ArtifactSize = rel.Artifact.Size
	}
	result := *s.lastInfo
	return &result, nil
}

// StartDownloadAndInstall 开始下载并解压暂存更新文件
func (s *Service) StartDownloadAndInstall() error {
	s.mu.RLock()
	app := s.app
	s.mu.RUnlock()

	if app == nil || app.Updater == nil {
		return fmt.Errorf("更新器尚未就绪")
	}

	// 异步启动下载流程，由事件流向前端推送进度
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		if err := app.Updater.DownloadAndInstall(ctx); err != nil {
			log.Printf("[Updater] 下载或安装更新失败: %v", err)
		}
	}()

	return nil
}

// RestartAndApply 重启应用程序并应用新版本（由 Wails helper 完成原子无缝替换）
func (s *Service) RestartAndApply() error {
	s.mu.RLock()
	app := s.app
	s.mu.RUnlock()

	if app == nil || app.Updater == nil {
		return fmt.Errorf("更新器尚未就绪")
	}

	return app.Updater.Restart(context.Background())
}

// GetStatus 获取当前更新器最新状态快照
func (s *Service) GetStatus() UpdateInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.lastInfo
}

// customAssetMatcher 智能构件匹配器，同时兼容 darwin / macos / windows 等平台命名习惯
func customAssetMatcher(req wailsUpdater.CheckRequest, assets []github.ReleaseAsset) int {
	plat := strings.ToLower(req.Platform)
	arch := strings.ToLower(req.Arch)

	for i, a := range assets {
		name := strings.ToLower(a.Name)
		if strings.HasSuffix(name, ".sig") || strings.HasSuffix(name, ".asc") || strings.HasSuffix(name, ".txt") || strings.Contains(name, "sha256") || strings.HasSuffix(name, ".json") {
			continue
		}

		// 平台匹配：darwin 同时匹配 macos、mac、osx
		if plat == "darwin" {
			if !strings.Contains(name, "darwin") && !strings.Contains(name, "macos") && !strings.Contains(name, "mac") {
				continue
			}
		} else if plat != "" && !strings.Contains(name, plat) {
			continue
		}

		// 架构匹配
		if strings.Contains(name, "universal") {
			return i
		}
		if arch == "arm64" && (strings.Contains(name, "arm64") || strings.Contains(name, "aarch64")) {
			return i
		}
		if arch == "amd64" && (strings.Contains(name, "amd64") || strings.Contains(name, "x86_64") || strings.Contains(name, "x64")) {
			return i
		}
		// 若名字包含平台但未限定具体架构（如 workpet-macOS.zip），默认命中
		if plat == "darwin" && (strings.Contains(name, "macos") || strings.Contains(name, "darwin")) && !strings.Contains(name, "x86") && !strings.Contains(name, "intel") {
			return i
		}
	}
	return -1
}
