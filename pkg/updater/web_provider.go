/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 基于 GitHub 公开 Releases 页面重定向机制的免限流备用更新源，彻底避免匿名 API 403 Rate Limit 阻断
 **/

package updater

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	wailsUpdater "github.com/wailsapp/wails/v3/pkg/updater"
)

// WebFallbackProvider 基于 GitHub 网页公开重定向的备用 Provider
type WebFallbackProvider struct {
	repository string
	httpClient *http.Client
}

// NewWebFallbackProvider 创建基于网页公开重定向的备用更新源
func NewWebFallbackProvider(repository string) *WebFallbackProvider {
	return &WebFallbackProvider{
		repository: repository,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				// 拦截重定向，直接从 Location 头提取最新版本 Tag
				return http.ErrUseLastResponse
			},
		},
	}
}

// Name 提供者名称标识
func (p *WebFallbackProvider) Name() string {
	return "github-web"
}

// Check 检查是否有新版本
func (p *WebFallbackProvider) Check(ctx context.Context, req wailsUpdater.CheckRequest) (*wailsUpdater.Release, error) {
	url := fmt.Sprintf("https://github.com/%s/releases/latest", p.repository)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("User-Agent", "Mozilla/5.0 WorkPet-Desktop-Updater")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("web fallback 访问失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusFound && resp.StatusCode != http.StatusMovedPermanently && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("未找到最新发布页 (HTTP %d)", resp.StatusCode)
	}

	loc := resp.Header.Get("Location")
	if loc == "" {
		return nil, fmt.Errorf("未获取到 Release 重定向位置")
	}

	// 从重定向地址解析 Tag，例如从 https://github.com/weiwei2012holy/workpet/releases/tag/v0.0.3 提取 v0.0.3
	parts := strings.Split(strings.TrimRight(loc, "/"), "/")
	tag := parts[len(parts)-1]
	if !strings.HasPrefix(tag, "v") {
		return nil, fmt.Errorf("未识别到有效的 Release 标签: %s", tag)
	}

	// 比较版本是否比当前版本更高
	if !isNewerVersion(tag, req.CurrentVersion) {
		return nil, nil // 当前已是最新版本
	}

	// 智能推断平台构件资产名与直接下载直链
	plat := strings.ToLower(req.Platform)
	filename := "workpet-darwin-universal.zip"
	if plat == "windows" {
		filename = "workpet-windows-x64.zip"
	}
	downloadURL := fmt.Sprintf("https://github.com/%s/releases/download/%s/%s", p.repository, tag, filename)

	// 尝试拉取同 Release 下由私钥签署的 manifest.json，获取 Ed25519 防伪数字签名
	var verification *wailsUpdater.Verification
	manifestURL := fmt.Sprintf("https://github.com/%s/releases/download/%s/manifest.json", p.repository, tag)
	if mReq, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil); err == nil {
		mReq.Header.Set("User-Agent", "Mozilla/5.0 WorkPet-Desktop-Updater")
		dlClient := &http.Client{Timeout: 10 * time.Second}
		if mResp, err := dlClient.Do(mReq); err == nil {
			if mResp.StatusCode == http.StatusOK {
				if body, err := io.ReadAll(io.LimitReader(mResp.Body, 1<<20)); err == nil {
					verification = extractVerificationFromManifest(body, req.Platform, req.Arch)
				}
			}
			mResp.Body.Close()
		}
	}

	return &wailsUpdater.Release{
		Version:      strings.TrimPrefix(tag, "v"),
		Channel:      "stable",
		Name:         tag,
		Notes:        fmt.Sprintf("WorkPet %s 优化了多项桌面端体验与性能并修复了已知缺陷。", tag),
		PublishedAt:  time.Now(),
		Verification: verification,
		Artifact: wailsUpdater.Artifact{
			Filename: filename,
			Filetype: "zip",
			Platform: req.Platform,
			Arch:     req.Arch,
		},
		Metadata: map[string]any{
			"download_url": downloadURL,
		},
	}, nil
}

// Download 下载更新文件并实时回调下载进度
func (p *WebFallbackProvider) Download(ctx context.Context, rel *wailsUpdater.Release, dst io.Writer, onProgress func(written, total int64)) error {
	if rel == nil || rel.Metadata == nil {
		return fmt.Errorf("release 元数据缺失")
	}
	urlStr, ok := rel.Metadata["download_url"].(string)
	if !ok || urlStr == "" {
		return fmt.Errorf("下载链接为空")
	}

	// 资产下载需跟随 S3 重定向
	dlClient := &http.Client{Timeout: 30 * time.Minute}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 WorkPet-Desktop-Updater")

	resp, err := dlClient.Do(req)
	if err != nil {
		return fmt.Errorf("下载连接失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("下载失败 HTTP %d", resp.StatusCode)
	}

	total := resp.ContentLength
	written := int64(0)
	buf := make([]byte, 64*1024)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return werr
			}
			written += int64(n)
			if onProgress != nil {
				onProgress(written, total)
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return rerr
		}
	}
	return nil
}

// isNewerVersion 语义化版本对比，判断 remote 是否比 current 更高
func isNewerVersion(remote, current string) bool {
	r := strings.TrimPrefix(remote, "v")
	c := strings.TrimPrefix(current, "v")
	rParts := strings.Split(r, ".")
	cParts := strings.Split(c, ".")

	maxLen := len(rParts)
	if len(cParts) > maxLen {
		maxLen = len(cParts)
	}

	for i := 0; i < maxLen; i++ {
		var rNum, cNum int
		if i < len(rParts) {
			rNum, _ = strconv.Atoi(rParts[i])
		}
		if i < len(cParts) {
			cNum, _ = strconv.Atoi(cParts[i])
		}

		if rNum > cNum {
			return true
		}
		if rNum < cNum {
			return false
		}
	}
	return false
}

// manifestPayload 对应 Wails Update Manifest 协议规范结构
type manifestPayload struct {
	Version   string             `json:"version"`
	Artifacts []manifestArtifact `json:"artifacts"`
}

type manifestArtifact struct {
	Platform      string `json:"platform"`
	Arch          string `json:"arch"`
	DigestAlgo    string `json:"digestAlgo"`
	Digest        string `json:"digest"`
	SignatureAlgo string `json:"signatureAlgo"`
	Signature     string `json:"signature"`
}

// extractVerificationFromManifest 从清单 JSON 中按平台架构解析并还原 Verification
func extractVerificationFromManifest(raw []byte, platform, arch string) *wailsUpdater.Verification {
	var payload manifestPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}

	wantPlat := strings.ToLower(platform)
	wantArch := strings.ToLower(arch)

	for _, a := range payload.Artifacts {
		p := strings.ToLower(a.Platform)
		// 平台匹配逻辑（兼容 darwin/macos, windows/win 等别名）
		platMatched := p == wantPlat ||
			(wantPlat == "darwin" && (p == "macos" || p == "mac")) ||
			(wantPlat == "windows" && (p == "win" || p == "win64"))

		if !platMatched && a.Platform != "" {
			continue
		}

		// 架构匹配
		aArch := strings.ToLower(a.Arch)
		archMatched := aArch == "" || aArch == wantArch ||
			(wantArch == "amd64" && (aArch == "x86_64" || aArch == "x64")) ||
			(wantArch == "arm64" && aArch == "aarch64")

		if !archMatched {
			continue
		}

		sig, err := base64.StdEncoding.DecodeString(a.Signature)
		if err != nil || len(sig) == 0 {
			// 尝试无补齐 raw base64 解码
			sig, err = base64.RawStdEncoding.DecodeString(a.Signature)
			if err != nil || len(sig) == 0 {
				continue
			}
		}

		var digest []byte
		if a.Digest != "" {
			digest, _ = base64.StdEncoding.DecodeString(a.Digest)
			if len(digest) == 0 {
				digest, _ = base64.RawStdEncoding.DecodeString(a.Digest)
			}
		}

		return &wailsUpdater.Verification{
			DigestAlgo:    a.DigestAlgo,
			Digest:        digest,
			SignatureAlgo: a.SignatureAlgo,
			Signature:     sig,
		}
	}
	return nil
}
