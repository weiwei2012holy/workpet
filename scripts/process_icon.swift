/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 自动化图标处理引擎：接收输入图片路径，生成符合 Apple macOS HIG 规范的 1024x1024 (824主体) PNG 与完整 iconset
 **/

import AppKit
import CoreGraphics
import Foundation

guard CommandLine.arguments.count >= 3 else {
    print("用法: swift process_icon.swift <输入图片绝对路径> <项目根目录绝对路径>")
    exit(1)
}

let sourcePath = CommandLine.arguments[1]
let projectDir = CommandLine.arguments[2]

guard let sourceImage = NSImage(contentsOfFile: sourcePath),
      let tiffData = sourceImage.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiffData),
      let cgSrc = rep.cgImage else {
    print("❌ 错误: 无法加载源图片，请确保文件存在且格式有效 (支持 PNG/JPG/HEIC/TIFF)")
    exit(1)
}

let srcW = rep.pixelsWide
let srcH = rep.pixelsHigh

// 1. 自动检测图片四周是否包含纯白/纯浅色边距并向内裁剪
var minX = 0
var maxX = srcW
var minY = 0
var maxY = srcH

// 从四周探测是否有连续近白/浅色边缘 (R>0.92, G>0.92, B>0.92)
var whiteLeft = 0
while whiteLeft < srcW / 4 {
    if let c = rep.colorAt(x: whiteLeft, y: srcH / 2),
       c.redComponent > 0.92 && c.greenComponent > 0.92 && c.blueComponent > 0.92 {
        whiteLeft += 1
    } else {
        break
    }
}

var whiteRight = srcW - 1
while whiteRight > srcW * 3 / 4 {
    if let c = rep.colorAt(x: whiteRight, y: srcH / 2),
       c.redComponent > 0.92 && c.greenComponent > 0.92 && c.blueComponent > 0.92 {
        whiteRight -= 1
    } else {
        break
    }
}

var whiteTop = 0
while whiteTop < srcH / 4 {
    if let c = rep.colorAt(x: srcW / 2, y: whiteTop),
       c.redComponent > 0.92 && c.greenComponent > 0.92 && c.blueComponent > 0.92 {
        whiteTop += 1
    } else {
        break
    }
}

var whiteBottom = srcH - 1
while whiteBottom > srcH * 3 / 4 {
    if let c = rep.colorAt(x: srcW / 2, y: whiteBottom),
       c.redComponent > 0.92 && c.greenComponent > 0.92 && c.blueComponent > 0.92 {
        whiteBottom -= 1
    } else {
        break
    }
}

// 如果检测到了明显的浅白外框，向内裁切并留 4px 缓冲区
let hasWhiteBorder = (whiteLeft > 10 || (srcW - 1 - whiteRight) > 10 || whiteTop > 10 || (srcH - 1 - whiteBottom) > 10)
let cropX = hasWhiteBorder ? min(whiteLeft + 4, srcW / 4) : 0
let cropY = hasWhiteBorder ? min(whiteTop + 4, srcH / 4) : 0
let cropW = hasWhiteBorder ? max(whiteRight - whiteLeft - 8, srcW / 2) : srcW
let cropH = hasWhiteBorder ? max(whiteBottom - whiteTop - 8, srcH / 2) : srcH

let cropRect = CGRect(x: cropX, y: cropY, width: cropW, height: cropH)
let croppedCG = cgSrc.cropping(to: cropRect) ?? cgSrc

// 2. 准备 1024x1024 透明画布
let canvasSize = CGSize(width: 1024, height: 1024)
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
    data: nil,
    width: Int(canvasSize.width),
    height: Int(canvasSize.height),
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    print("❌ 错误: 创建图形上下文失败")
    exit(1)
}

context.clear(CGRect(origin: .zero, size: canvasSize))

// 3. Apple macOS HIG 标准规范主体排版：
// 1024x1024 画布，824x824 主体，四周留 100px 边距，185 圆角
let bodySize: CGFloat = 824.0
let bodyX: CGFloat = (1024.0 - bodySize) / 2.0 // 100
let bodyY: CGFloat = (1024.0 - bodySize) / 2.0 // 100
let bodyRect = CGRect(x: bodyX, y: bodyY, width: bodySize, height: bodySize)
let cornerRadius: CGFloat = 185.0

let squirclePath = CGPath(roundedRect: bodyRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

// 4. 绘制标准轻柔环境底影
context.saveGState()
let shadowColor = NSColor(calibratedRed: 0.0, green: 0.0, blue: 0.0, alpha: 0.28).cgColor
context.setShadow(offset: CGSize(width: 0, height: -12), blur: 24, color: shadowColor)
context.addPath(squirclePath)
context.setFillColor(NSColor(calibratedRed: 0.2, green: 0.2, blue: 0.2, alpha: 0.8).cgColor)
context.fillPath()
context.restoreGState()

// 5. 绘制裁切后的核心主体
context.saveGState()
context.addPath(squirclePath)
context.clip()
context.interpolationQuality = .high
context.draw(croppedCG, in: bodyRect)
context.restoreGState()

guard let standardCG = context.makeImage() else {
    print("❌ 错误: 合成图像失败")
    exit(1)
}

// 6. 导出标准 1024x1024 PNG
let standardRep = NSBitmapImageRep(cgImage: standardCG)
guard let pngData = standardRep.representation(using: .png, properties: [:]) else {
    print("❌ 错误: 转换为 PNG 失败")
    exit(1)
}

let appIconPNGPath = "\(projectDir)/build/appicon.png"
let frontendLogoPath = "\(projectDir)/frontend/public/app-logo.png"

try pngData.write(to: URL(fileURLWithPath: appIconPNGPath))
try pngData.write(to: URL(fileURLWithPath: frontendLogoPath))

// 7. 构建 macOS 标准 iconset
let iconsetDir = "\(projectDir)/build/darwin/icons.iconset"
let fileManager = FileManager.default
try? fileManager.removeItem(atPath: iconsetDir)
try fileManager.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

let sizes: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (name, px) in sizes {
    guard let ctx = CGContext(
        data: nil,
        width: px,
        height: px,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { continue }

    ctx.interpolationQuality = .high
    ctx.draw(standardCG, in: CGRect(x: 0, y: 0, width: px, height: px))
    if let img = ctx.makeImage() {
        let r = NSBitmapImageRep(cgImage: img)
        if let d = r.representation(using: .png, properties: [:]) {
            try d.write(to: URL(fileURLWithPath: "\(iconsetDir)/\(name)"))
        }
    }
}

print("✅ 图标切图与 iconset 生成完毕！")
