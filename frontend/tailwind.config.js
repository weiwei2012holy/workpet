/**
 * @Author wei
 * @Date 2026-11-07
 * @Description Tailwind CSS 主题配置，100% 严谨映射 Tweakcn Cosmic Night 官方色彩规范
 *
 * 【关键规范】所有颜色 Token 一律采用 RGB 通道格式：`rgb(var(--x) / <alpha-value>)`，
 * 与 index.css 中 `--x: R G B`（空格分隔的三元组）严格配套。
 *
 * 原因：Tailwind v3 无法为 `var(--x)` 形式的颜色推导透明度变体。若写成 `var(--x)`，
 * 则 `bg-primary/20`、`text-state-working/90`、`border-border/50` 这类带透明度修饰符的
 * 工具类会被**静默丢弃**（既不生成也不报错），导致图标、按钮、卡片底色全部失效。
 * 改用通道格式后，Tailwind 可生成 `rgb(110 86 207 / 0.2)` 这样的合法声明。
 **/

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        state: {
          working: "rgb(var(--state-working) / <alpha-value>)",
          alerting: "rgb(var(--state-alerting) / <alpha-value>)",
          away: "rgb(var(--state-away) / <alpha-value>)",
          offduty: "rgb(var(--state-offduty) / <alpha-value>)",
          paused: "rgb(var(--state-paused) / <alpha-value>)",
          ready: "rgb(var(--state-ready) / <alpha-value>)",
        },
        traffic: {
          close: "rgb(var(--traffic-close) / <alpha-value>)",
          minimize: "rgb(var(--traffic-minimize) / <alpha-value>)",
          maximize: "rgb(var(--traffic-maximize) / <alpha-value>)",
        },
        chart: {
          1: "rgb(var(--chart-1) / <alpha-value>)",
          2: "rgb(var(--chart-2) / <alpha-value>)",
          3: "rgb(var(--chart-3) / <alpha-value>)",
          4: "rgb(var(--chart-4) / <alpha-value>)",
          5: "rgb(var(--chart-5) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
