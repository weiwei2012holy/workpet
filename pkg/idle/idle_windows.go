/**
 * @Author wei
 * @Date 2026-11-03
 * @Description Windows 平台 user32.dll 物理键鼠空闲时间感知实现
 **/

//go:build windows

package idle

import (
	"syscall"
	"unsafe"
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	kernel32             = syscall.NewLazyDLL("kernel32.dll")
	procGetLastInputInfo = user32.NewProc("GetLastInputInfo")
	procGetTickCount64   = kernel32.NewProc("GetTickCount64")
)

type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

func getPlatformIdleTime() float64 {
	var lii lastInputInfo
	lii.cbSize = uint32(unsafe.Sizeof(lii))

	ret, _, _ := procGetLastInputInfo.Call(uintptr(unsafe.Pointer(&lii)))
	if ret == 0 {
		return 0
	}

	tickRet, _, _ := procGetTickCount64.Call()
	currentTick := uint32(tickRet)

	elapsedMs := currentTick - lii.dwTime
	return float64(elapsedMs) / 1000.0
}
