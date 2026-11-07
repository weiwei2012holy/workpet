#!/usr/bin/env python3
"""
@Author wei
@Date 2026-11-07
@Description 规范化还原自动更新签名私钥（兼容纯 Base64、标准换行 PEM 与转义换行字符）
"""

import os
import sys

def main():
    raw = os.environ.get("UPDATER_KEY", "").strip()
    if not raw:
        print("错误: 未检测到 UPDATER_KEY 环境变量", file=sys.stderr)
        sys.exit(1)

    # 兼容处理：如果换行符被转义成字面量 \n 且没有真实换行，予以还原
    if "\\n" in raw and "\n" not in raw:
        raw = raw.replace("\\n", "\n")

    out_path = sys.argv[1] if len(sys.argv) > 1 else "updater.key"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(raw.strip() + "\n")
    print(f"成功写入私钥文件: {out_path}")

if __name__ == "__main__":
    main()
