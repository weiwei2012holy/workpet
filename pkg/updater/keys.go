/**
 * @Author wei
 * @Date 2026-11-07
 * @Description 存放内嵌的 Ed25519 自动更新签名公钥（Trust Root），用于在更新时进行 Fail-Closed 严苛防篡改校验
 **/

package updater

import (
	_ "embed"
)

//go:embed updater.key.pub
var UpdaterPublicKey []byte
