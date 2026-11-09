#!/usr/bin/env python3
"""
 * @Author wei
 * @Date 2026-11-09
 * @Description 规范化还原自动更新签名私钥（全兼容纯 Base64、PKCS#8 DER、单行带空格 PEM、转义换行符及 Base64 嵌套）
"""

import base64
import os
import re
import sys

# Ed25519 PKCS#8 DER 固定头部（16 字节）
PKCS8_ED25519_PREFIX = bytes.fromhex("302e020100300506032b657004220420")

def normalize_key(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        raise ValueError("输入内容为空")

    # 去除首尾包裹的双引号或单引号
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1].strip()

    # 还原转义换行符（如 GitHub UI / bash 传递时字面量的 \\n 或 \\r\\n）
    raw = raw.replace("\\r\\n", "\n").replace("\\n", "\n")

    # 兼容处理：检查是否整段内容被额外进行了 Base64 包装
    try:
        decoded_maybe = base64.b64decode(raw)
        if b"-----BEGIN" in decoded_maybe:
            raw = decoded_maybe.decode("utf-8", errors="ignore").strip()
    except Exception:
        pass

    # 尝试匹配 PEM 头尾
    pem_match = re.search(r"-----BEGIN[^-]+-----(.*?)-----END[^-]+-----", raw, re.DOTALL)
    if pem_match:
        body = "".join(pem_match.group(1).split())
    else:
        body = "".join(raw.split())

    try:
        der = base64.b64decode(body)
    except Exception as e:
        raise ValueError(f"Base64 解码失败: {e}")

    # 分析并重构合法的 PKCS#8 Ed25519 DER
    if len(der) == 48 and der.startswith(PKCS8_ED25519_PREFIX):
        # 已经是标准 PKCS#8 DER (16 字节头部 + 32 字节私钥种子)
        final_der = der
    elif len(der) == 32:
        # 是 32 字节的原始 Ed25519 Seed，补充 PKCS#8 头部
        final_der = PKCS8_ED25519_PREFIX + der
    elif len(der) == 64:
        # 是 64 字节的原始 Ed25519 私钥，取前 32 字节 Seed 并补充 PKCS#8 头部
        final_der = PKCS8_ED25519_PREFIX + der[:32]
    else:
        # 兜底直接使用原 DER
        final_der = der

    # 转换为标准 PEM 格式，每 64 字符换行
    b64_str = base64.b64encode(final_der).decode("ascii")
    chunks = [b64_str[i:i+64] for i in range(0, len(b64_str), 64)]
    return "-----BEGIN PRIVATE KEY-----\n" + "\n".join(chunks) + "\n-----END PRIVATE KEY-----\n"

def main():
    raw = os.environ.get("UPDATER_KEY", "").strip()
    if not raw:
        print("错误: 未检测到 UPDATER_KEY 环境变量", file=sys.stderr)
        sys.exit(1)

    try:
        pem_content = normalize_key(raw)
    except Exception as err:
        print(f"解析私钥格式失败: {err}", file=sys.stderr)
        sys.exit(1)

    out_path = sys.argv[1] if len(sys.argv) > 1 else "updater.key"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(pem_content)

    print(f"✅ 成功规范化并写入 Ed25519 PKCS#8 私钥文件: {out_path}")

if __name__ == "__main__":
    main()
