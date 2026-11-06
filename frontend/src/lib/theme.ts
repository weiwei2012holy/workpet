/**
 * @Author wei
 * @Date 2026-11-04
 * @Description 全局主题与外观模式管理器，支持黑夜/白天/跟随系统，并预留多主题插槽
 **/

export type ThemeMode = "system" | "dark" | "light";

export interface ThemeConfig {
  id: string;
  name: string;
}

// 预留的主题列表，当前默认 cosmic-night，方便后续轻松扩展
export const AVAILABLE_THEMES: ThemeConfig[] = [
  { id: "cosmic-night", name: "Cosmic Night (深空极光)" },
  // 未来直接在此拓展，如:
  // { id: "tangerine", name: "Tangerine (落日盛宴)" },
  // { id: "cyberpunk", name: "Cyberpunk (赛博霓虹)" },
];

const THEME_MODE_STORAGE_KEY = "workpet_theme_mode";
export const ACTIVE_THEME_STORAGE_KEY = "workpet_active_theme";

// 获取当前存储的主题 ID，默认 "cosmic-night"
export function getActiveThemeId(): string {
  return localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || "cosmic-night";
}

// 设置当前激活的主题 ID（预留供未来扩展）
export function setActiveThemeId(themeId: string): void {
  localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
}

// 获取当前存储的模式，默认 "system" (跟随系统)
export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return "system";
}

// 获取系统当前是否处于深色偏好
export function isSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return true;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// 解析出最终渲染的明暗状态 ("dark" 或 "light")
export function resolveEffectiveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return isSystemDark() ? "dark" : "light";
  }
  return mode;
}

// 应用主题模式到 document 根节点
export function applyThemeMode(mode: ThemeMode): "dark" | "light" {
  const effective = resolveEffectiveTheme(mode);
  const root = document.documentElement;

  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 同步属性供可能需要的 CSS 选择器使用
  root.setAttribute("data-theme-mode", mode);
  root.setAttribute("data-color-scheme", effective);

  return effective;
}

// 保存并生效新的模式
export function setThemeMode(mode: ThemeMode): "dark" | "light" {
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  return applyThemeMode(mode);
}

// 初始化全局主题监听器（监听系统明暗变化）
export function initThemeListener(onChange?: (effective: "dark" | "light", mode: ThemeMode) => void) {
  const currentMode = getStoredThemeMode();
  applyThemeMode(currentMode);

  if (typeof window !== "undefined" && window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const mode = getStoredThemeMode();
      if (mode === "system") {
        const effective = applyThemeMode("system");
        onChange?.(effective, "system");
      }
    };

    // 现代浏览器与 WebKit 监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }
  return () => {};
}
