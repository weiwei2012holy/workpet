/**
 * @Author wei
 * @Date 2026-11-04
 * @Description 前端根应用入口，智能调度随行桌面挂件与大屏控制看板双窗口形态，并动态注入窗口样式类
 **/

import { useState, useEffect } from "react";
import ActivityWidget from "./tools/activity/ActivityWidget";
import { MainDashboard } from "./dashboard/MainDashboard";
import { initThemeListener } from "@/lib/theme";

export default function App() {
  // 检测当前 Webview 窗口模式：dashboard（大屏控制中心）或 widget（随行悬浮挂件）
  const [isDashboard, setIsDashboard] = useState<boolean>(false);

  useEffect(() => {
    // 全局启动主题偏好监听，保证小挂件与控制看板同步适配深色/浅色模式
    const cleanupTheme = initThemeListener();

    const searchParams = new URLSearchParams(window.location.search);
    const windowType = searchParams.get("window");
    const isDash = windowType === "dashboard";
    setIsDashboard(isDash);

    // 动态调整 body 类名以适配窗口尺寸与背景
    if (isDash) {
      document.body.classList.remove("is-widget-window");
      document.body.classList.add("is-dashboard-window");
    } else {
      document.body.classList.remove("is-dashboard-window");
      document.body.classList.add("is-widget-window");
    }

    return () => {
      if (cleanupTheme) cleanupTheme();
    };
  }, []);

  // 1. 如果是大屏控制看板模式
  if (isDashboard) {
    return <MainDashboard />;
  }

  // 2. 默认随行桌面悬浮挂件模式（极简消息通知弹窗）
  return <ActivityWidget />;
}
