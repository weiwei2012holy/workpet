/**
 * @Author wei
 * @Date 2026-11-07
 * @Description 自更新模块与签名校验单元测试，覆盖 Ed25519 公钥载入、Manifest 清单解析与资产过滤匹配
 **/

package updater

import (
	"crypto/x509"
	"encoding/pem"
	"testing"

	wailsUpdater "github.com/wailsapp/wails/v3/pkg/updater"
	"github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

// TestUpdaterPublicKeyEmbedded 验证内嵌公钥存在且可正常被标准 x509/Ed25519 解析
func TestUpdaterPublicKeyEmbedded(t *testing.T) {
	if len(UpdaterPublicKey) == 0 {
		t.Fatal("UpdaterPublicKey 不能为空，必须随二进制嵌入")
	}

	block, _ := pem.Decode(UpdaterPublicKey)
	if block == nil {
		t.Fatal("UpdaterPublicKey 无法解析为 PEM 格式")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		t.Fatalf("解析 PKIX 公钥失败: %v", err)
	}
	if pub == nil {
		t.Fatal("公钥实例解析为 nil")
	}
}

// TestExtractVerificationFromManifest 验证从 Wails Update Manifest 提取 Verification 结构体
func TestExtractVerificationFromManifest(t *testing.T) {
	manifestJSON := []byte(`{
		"schemaVersion": 1,
		"version": "0.1.1",
		"artifacts": [
			{
				"platform": "darwin",
				"arch": "",
				"digestAlgo": "sha512",
				"digest": "aDPzVHDr/t4MI1xlafkDYUi4MwDa0ODMOr8CWIkAmSDkElMtBv1MDIdKq0mj30njNUWH0L16mBP/mXdBZXimnQ==",
				"signatureAlgo": "ed25519ph",
				"signature": "PjeJVQwFMLZeS4TOD7Y0o4feYUvSWKF3ceiS1gwzYAAlh2rb9P/7wo72RGNPsSBPzdBYv/do+ZuSN2Hr3HUXDQ=="
			},
			{
				"platform": "windows",
				"arch": "amd64",
				"digestAlgo": "sha512",
				"digest": "dGVzdC1kaWdlc3Q=",
				"signatureAlgo": "ed25519ph",
				"signature": "dGVzdC1zaWc="
			}
		]
	}`)

	v := extractVerificationFromManifest(manifestJSON, "darwin", "arm64")
	if v == nil {
		t.Fatal("未成功提取 darwin 平台 verification")
	}
	if v.SignatureAlgo != "ed25519ph" {
		t.Errorf("签名算法期望 ed25519ph, 得到 %s", v.SignatureAlgo)
	}
	if len(v.Signature) == 0 {
		t.Error("签名字节不应为空")
	}
	if len(v.Digest) == 0 {
		t.Error("摘要字节不应为空")
	}

	// 测试 Windows 平台提取
	vWin := extractVerificationFromManifest(manifestJSON, "windows", "amd64")
	if vWin == nil {
		t.Fatal("未成功提取 windows 平台 verification")
	}
	if string(vWin.Signature) != "test-sig" {
		t.Errorf("windows 签名解析不符: %s", string(vWin.Signature))
	}
}

// TestCustomAssetMatcher 验证构件匹配器跳过辅助文件并精准匹配目标产物
func TestCustomAssetMatcher(t *testing.T) {
	assets := []github.ReleaseAsset{
		{Name: "SHA256SUMS"},
		{Name: "manifest.json"},
		{Name: "workpet-darwin-universal.zip.sig"},
		{Name: "workpet-darwin-universal.zip"},
		{Name: "workpet-windows-x64.zip"},
	}

	reqDarwin := wailsUpdater.CheckRequest{Platform: "darwin", Arch: "arm64"}
	idx := customAssetMatcher(reqDarwin, assets)
	if idx != 3 {
		t.Fatalf("darwin 匹配期望下标 3 (workpet-darwin-universal.zip), 得到 %d", idx)
	}

	reqWin := wailsUpdater.CheckRequest{Platform: "windows", Arch: "amd64"}
	idxWin := customAssetMatcher(reqWin, assets)
	if idxWin != 4 {
		t.Fatalf("windows 匹配期望下标 4 (workpet-windows-x64.zip), 得到 %d", idxWin)
	}
}
