#!/bin/bash
#
# @Author wei
# @Date 2026-11-06
# @Description 一键更换 WorkPet macOS Dock 栏与应用图标的自动化脚本
#

set -e

# 定位项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 检查输入参数
if [ -z "$1" ]; then
    echo "=========================================================="
    echo "🐾 WorkPet 应用与 Dock 栏图标一键更换工具"
    echo "=========================================================="
    echo "用法:"
    echo "  ./scripts/update_icon.sh <图片路径>"
    echo ""
    echo "示例:"
    echo "  ./scripts/update_icon.sh ~/Downloads/my_pet.png"
    echo "  ./scripts/update_icon.sh /path/to/avatar.jpg"
    echo "=========================================================="
    exit 1
fi

INPUT_IMAGE="$1"

# 转换为绝对路径
if [[ "$INPUT_IMAGE" != /* ]]; then
    INPUT_IMAGE="$(pwd)/$INPUT_IMAGE"
fi

if [ ! -f "$INPUT_IMAGE" ]; then
    echo "❌ 错误: 文件不存在 -> $INPUT_IMAGE"
    exit 1
fi

echo "🚀 [1/5] 开始处理输入图像: $INPUT_IMAGE ..."
swift "${SCRIPT_DIR}/process_icon.swift" "$INPUT_IMAGE" "$PROJECT_DIR"

echo "🎨 [2/5] 使用 macOS 原生 iconutil 编译 Retina .icns 资产..."
iconutil -c icns "${PROJECT_DIR}/build/darwin/icons.iconset" -o "${PROJECT_DIR}/build/darwin/icons.icns"

echo "📂 [3/5] 同步更新应用包资源..."
cp "${PROJECT_DIR}/build/darwin/icons.icns" "${PROJECT_DIR}/bin/workpet.app/Contents/Resources/icons.icns"
cp "${PROJECT_DIR}/build/darwin/icons.icns" "${PROJECT_DIR}/bin/workpet.dev.app/Contents/Resources/icons.icns"
cp "${PROJECT_DIR}/build/darwin/icons.icns" "${PROJECT_DIR}/build/darwin/dmg-file-icon.icns"

echo "🔨 [4/5] 重新编译 Go 桌面原生二进制 (嵌入最新图标)..."
export GOPATH=/Users/yidejia/Project
cd "$PROJECT_DIR"
go build -tags "production,private_mac_apis" -trimpath -o bin/workpet .
cp bin/workpet bin/workpet.app/Contents/MacOS/workpet
cp bin/workpet bin/workpet.dev.app/Contents/MacOS/workpet

echo "🔄 [5/5] 刷新系统 LaunchServices 缓存与 Dock 栏..."
pkill -f "bin/workpet.app" || true
touch "${PROJECT_DIR}/bin/workpet.app"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${PROJECT_DIR}/bin/workpet.app"
killall Dock
sleep 0.8
open "${PROJECT_DIR}/bin/workpet.app"

echo "=========================================================="
echo "🎉 恭喜！WorkPet Dock 栏与应用图标更换成功并已生效！"
echo "=========================================================="
