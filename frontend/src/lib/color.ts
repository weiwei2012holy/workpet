/**
 * @Author wei
 * @Date 2026-11-07
 * @Description CSS 颜色变量解析工具，专供 Canvas 等无法解析 var() 的场景使用
 **/

/**
 * 将 CSS 颜色变量解析为浏览器可识别的实际颜色字符串。
 *
 * 【背景】项目中的颜色 Token 统一书写为「空格分隔的 RGB 通道三元组」
 * （如 `--primary: 110 86 207`），由 Tailwind 通过
 * `rgb(var(--primary) / <alpha-value>)` 消费。
 *
 * 但 Canvas 2D 的 `fillStyle` 不参与 CSS 变量解析 —— 传入 `var(--primary)`
 * 或 `rgb(var(--primary))` 都会静默失效并回退为黑色。因此必须先通过
 * `getComputedStyle` 取出通道值，再拼装成合法颜色字符串。
 *
 * @param varName  CSS 变量名（需带 `--` 前缀），如 `"--primary"`
 * @param fallback 变量不存在时的兜底颜色
 * @returns        形如 `"rgb(110 86 207)"` 的合法颜色字符串
 *
 * @example
 *   resolveCssColor("--primary", "#6e56cf")  // → "rgb(110 86 207)"
 */
export function resolveCssColor(varName: string, fallback = "#000000"): string {
  // SSR / 非浏览器环境直接返回兜底色
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  if (!raw) return fallback;

  // 通道格式（如 "110 86 207"）需包裹 rgb() 才是合法颜色；
  // 若变量本身已是完整颜色值（hex、rgb()、颜色关键字等）则原样返回。
  return /^[\d\s.]+$/.test(raw) ? `rgb(${raw})` : raw;
}
