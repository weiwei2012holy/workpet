/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 无边框控制看板主视口（MainDashboard），支持视口可见性休眠与按需数据唤醒，后台零空转
 **/

import React, { useState, useEffect } from "react";
import { LayoutGrid, Wrench, Sliders, ExternalLink, Minus, X } from "lucide-react";
import ShinyText from "@/components/ShinyText/ShinyText";
import ClickSpark from "@/components/ClickSpark/ClickSpark";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolveCssColor } from "@/lib/color";
import { DashboardView } from "./DashboardView";
import { ToolHubView } from "./ToolHubView";
import { SettingsView } from "./SettingsView";
import { WidgetGalleryModal } from "./WidgetGalleryModal";

import * as SystemService from "@/../bindings/workpet/pkg/system/service";
import * as ActivityService from "@/../bindings/workpet/pkg/tools/activity/service";
import {
  APP_EVENTS,
  subscribeEvent,
  ToolChangedPayload,
  DashboardWidgetsPayload,
  ActivityStatsPayload,
  ReminderTickPayload,
} from "@/types/events";

export const MainDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // ClickSpark 使用 Canvas 2D 绘制粒子，其 fillStyle 无法解析 CSS 变量，
  // 故挂载后从计算样式中取出 --primary 的实际颜色值再传入。
  const [sparkColor, setSparkColor] = useState<string>("#6e56cf");
  useEffect(() => {
    setSparkColor(resolveCssColor("--primary", "#6e56cf"));
  }, []);

  // 系统配置状态
  const [settings, setSettings] = useState({
    autostart: false,
    autostartStatus: false,
    autoHideWidget: true,
    globalShortcut: "CmdOrCtrl+Shift+R",
    enabledTools: ["activity", "datetime"],
    dashboardWidgets: [
      "activity-timer",
      "activity-focus-today",
      "activity-rest-today",
      "activity-trend",
      "activity-status",
    ],
    appVersion: "",
  });

  // 活动追踪统计数据与实时状态
  const [stats, setStats] = useState<any>({
    todayFocusMinutes: 0,
    todayRestMinutes: 0,
    restCount: 0,
    currentState: "working",
    hourlyFocus: new Array(24).fill(0),
    todayDate: "",
  });

  const [reminderState, setReminderState] = useState<any>({
    intervalMinutes: 30,
    elapsedSeconds: 0,
    remainingSeconds: 1800,
    isPaused: false,
    isReminding: false,
    restCount: 0,
    isAway: false,
    isOffDuty: false,
    idleThresholdMinutes: 3,
    offDutyThresholdMinutes: 30,
    currentIdleSeconds: 0,
  });

  // 1. 初始化拉取后端配置与统计数据
  useEffect(() => {
    const initData = async () => {
      try {
        const appCfg = await SystemService.GetAppSettings();
        if (appCfg) {
          setSettings({
            autostart: appCfg.autostart,
            autostartStatus: appCfg.autostartStatus,
            autoHideWidget: appCfg.autoHideWidget,
            globalShortcut: appCfg.globalShortcut,
            enabledTools: (() => {
              const list = appCfg.enabledTools ? [...appCfg.enabledTools] : ["activity"];
              if (!list.includes("datetime")) list.push("datetime");
              return list;
            })(),
            dashboardWidgets: appCfg.dashboardWidgets || [
              "activity-focus-today",
              "activity-rest-today",
              "activity-trend",
              "activity-status",
            ],
            appVersion: appCfg.appVersion || "",
          });
        }
      } catch (e) {
        console.error("加载应用设置失败:", e);
      }

      try {
        const actStats = await ActivityService.GetStats();
        if (actStats) setStats(actStats);
        const remState = await ActivityService.GetState();
        if (remState) setReminderState(remState);
      } catch (e) {
        console.error("加载活动状态失败:", e);
      }
    };

    initData();

    // 2. 监听事件实时更新（强类型订阅契约，视口感知节能）
    const unbindStats = subscribeEvent<ActivityStatsPayload>(
      APP_EVENTS.ACTIVITY_STATS_UPDATE,
      (data) => {
        // 切后台时静默，仅在前台可见时更新走势
        if (document.visibilityState === "visible") {
          setStats(data);
        }
      }
    );

    const unbindTick = subscribeEvent<ReminderTickPayload>(
      APP_EVENTS.REMINDER_TICK,
      (data) => {
        // 核心节能优化：当看板被遮挡/切后台时跳过秒级时钟跳动的虚拟DOM重绘；告警触发或前台可见时正常响应
        if (document.visibilityState === "visible" || data.isReminding) {
          setReminderState(data);
        }
      }
    );

    // 视口感知：当看板窗口重新恢复可见或获得焦点时，立即拉取一次最新状态对齐展示
    const handleForeground = () => {
      if (document.visibilityState === "visible") {
        initData();
      }
    };

    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);

    const unbindWidgets = subscribeEvent<DashboardWidgetsPayload>(
      APP_EVENTS.DASHBOARD_WIDGETS_CHANGED,
      (widgets) => {
        if (Array.isArray(widgets)) {
          setSettings((prev) => ({ ...prev, dashboardWidgets: widgets }));
        }
      }
    );

    // 补齐 tools-changed 事件监听，跨窗口实时同步工具启闭状态
    const unbindTools = subscribeEvent<ToolChangedPayload>(
      APP_EVENTS.TOOLS_CHANGED,
      ({ toolId, enabled }) => {
        setSettings((prev) => {
          let updated = prev.enabledTools.filter((id) => id !== toolId);
          if (enabled) updated.push(toolId);
          return { ...prev, enabledTools: updated };
        });
      }
    );

    return () => {
      if (unbindStats) unbindStats();
      if (unbindTick) unbindTick();
      if (unbindWidgets) unbindWidgets();
      if (unbindTools) unbindTools();
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, []);

  // 添加小组件到看板
  const handleAddWidget = async (widgetId: string) => {
    if (!settings.dashboardWidgets.includes(widgetId)) {
      const updated = [...settings.dashboardWidgets, widgetId];
      setSettings((prev) => ({ ...prev, dashboardWidgets: updated }));
      await SystemService.SaveDashboardWidgets(updated);
    }
  };

  // 从看板移除小组件
  const handleRemoveWidget = async (widgetId: string) => {
    const updated = settings.dashboardWidgets.filter((id) => id !== widgetId);
    setSettings((prev) => ({ ...prev, dashboardWidgets: updated }));
    await SystemService.SaveDashboardWidgets(updated);
  };

  // 拖拽重排小组件并持久化存储
  const handleReorderWidgets = async (newOrder: string[]) => {
    setSettings((prev) => ({ ...prev, dashboardWidgets: newOrder }));
    await SystemService.SaveDashboardWidgets(newOrder);
  };

  // 启闭工具
  const handleToggleTool = async (toolId: string, enabled: boolean) => {
    let updatedTools = settings.enabledTools.filter((id) => id !== toolId);
    if (enabled) updatedTools.push(toolId);
    setSettings((prev) => ({ ...prev, enabledTools: updatedTools }));
    await SystemService.SetToolEnabled(toolId, enabled);
  };

  // 保存活动追踪配置
  const handleActivityConfigSaved = (interval: number, idleThreshold: number, offDutyThreshold: number) => {
    setReminderState((prev: any) => ({
      ...prev,
      intervalMinutes: interval,
      idleThresholdMinutes: idleThreshold,
      offDutyThresholdMinutes: offDutyThreshold,
    }));
  };

  return (
    <ClickSpark sparkColor={sparkColor} sparkSize={7} sparkRadius={18} sparkCount={6}>
      <div className="w-screen h-screen flex flex-col bg-background text-foreground select-none overflow-hidden font-sans border border-border rounded-2xl shadow-2xl">
        {/* 无边框原生极光标题控制栏（集成拖拽区与窗口控制） */}
        <header
          style={{ "--wails-draggable": "drag" } as React.CSSProperties}
          className="h-14 px-5 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-md shrink-0 cursor-grab active:cursor-grabbing"
        >
          {/* 左侧：macOS 风格三色胶囊控制按钮 + 应用标识 */}
          <div className="flex items-center gap-4">
            {/* macOS 交通灯三色按钮 */}
            <div
              style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
              className="flex items-center gap-2 group/traffic mr-1"
            >
              <button
                onClick={() => SystemService.CloseDashboard()}
                className="size-3.5 rounded-full bg-traffic-close border border-traffic-close/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                title="关闭/隐藏窗口 (Cmd+W)"
              >
                <X size={8} className="opacity-0 group-hover/traffic:opacity-100 text-black font-bold" />
              </button>
              <button
                onClick={() => SystemService.MinimizeDashboard()}
                className="size-3.5 rounded-full bg-traffic-minimize border border-traffic-minimize/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                title="最小化窗口"
              >
                <Minus size={8} className="opacity-0 group-hover/traffic:opacity-100 text-black font-bold" />
              </button>
              <button
                onClick={() => SystemService.OpenWidget()}
                className="size-3.5 rounded-full bg-traffic-maximize border border-traffic-maximize/80 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                title="唤起桌面随行挂件"
              >
                <ExternalLink size={8} className="opacity-0 group-hover/traffic:opacity-100 text-black font-bold" />
              </button>
            </div>

            {/* 应用 Logo 与标题 */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-sm shadow-sm">
                🪐
              </div>
              <div className="flex items-center gap-2">
                <ShinyText
                  text="WorkPet"
                  color="rgb(var(--foreground))"
                  shineColor="rgb(var(--primary))"
                  speed={3}
                  className="text-base font-bold tracking-wider"
                />
                <Badge variant="secondary" className="text-[11px] font-mono px-2 py-0.5">
                  {settings.appVersion}
                </Badge>
              </div>
            </div>
          </div>

          {/* 中间主要视图切换：采用 shadcn Tabs */}
          <div style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted border border-border">
                <TabsTrigger value="dashboard" className="flex items-center gap-1.5 px-3.5 py-1 text-xs">
                  <LayoutGrid size={14} />
                  <span>指标看板</span>
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-1.5 px-3.5 py-1 text-xs">
                  <Wrench size={14} />
                  <span>工具箱</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1.5 px-3.5 py-1 text-xs">
                  <Sliders size={14} />
                  <span>系统设置</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 右侧辅助操作：外观明暗切换 */}
          <div
            style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
            className="flex items-center gap-2.5"
          >
            {/* 白天 / 黑夜 / 跟随系统 模式切换按钮 */}
            <ThemeToggle />
          </div>
        </header>

        {/* 主视口内容区 */}
        <main className="flex-1 flex overflow-hidden bg-background">
          {activeTab === "dashboard" && (
            <DashboardView
              widgetIds={settings.dashboardWidgets}
              enabledTools={settings.enabledTools}
              stats={stats}
              reminderState={reminderState}
              onRemoveWidget={handleRemoveWidget}
              onReorderWidgets={handleReorderWidgets}
              onOpenGallery={() => setIsGalleryOpen(true)}
            />
          )}

          {activeTab === "tools" && (
            <ToolHubView
              enabledTools={settings.enabledTools}
              onToggleTool={handleToggleTool}
              activityConfig={{
                intervalMinutes: reminderState.intervalMinutes,
                idleThresholdMinutes: reminderState.idleThresholdMinutes,
                offDutyThresholdMinutes: reminderState.offDutyThresholdMinutes || 30,
              }}
              onActivityConfigSaved={handleActivityConfigSaved}
              stats={stats}
              reminderState={reminderState}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(newSettings) => setSettings(newSettings)}
            />
          )}
        </main>

        {/* 小组件库选择弹窗 */}
        <WidgetGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          activeWidgetIds={settings.dashboardWidgets}
          enabledTools={settings.enabledTools}
          onAddWidget={handleAddWidget}
        />
      </div>
    </ClickSpark>
  );
};
