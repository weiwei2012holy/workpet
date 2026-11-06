/**
 * @Author wei
 * @Date 2026-11-03
 * @Description macOS 平台 CoreGraphics 物理键鼠空闲时间感知实现
 **/

//go:build darwin

package idle

/*
#cgo LDFLAGS: -framework CoreGraphics
#include <CoreGraphics/CoreGraphics.h>

static double getSecondsSinceLastInput() {
    return (double)CGEventSourceSecondsSinceLastEventType(
        kCGEventSourceStateCombinedSessionState,
        kCGAnyInputEventType
    );
}
*/
import "C"

func getPlatformIdleTime() float64 {
	return float64(C.getSecondsSinceLastInput())
}
