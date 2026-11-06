/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 无边框控制看板主视口（MainDashboard），支持午休/下班长时间离座排除配置联动，100% 严谨采用 Tweakcn Cosmic Night 官方规范
 **/

import React, { useState, useEffect } from "react";
import { LayoutGrid, Wrench, Sliders, ExternalLink, Minus, X } from "lucide-react";
import ShinyText from "@/components/ShinyText/ShinyText";
import ClickSpark from "@/components/ClickSpark/ClickSpark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardView } from "./DashboardView";
import { ToolHubView } from "./ToolHubView";
import { SettingsView } from "./SettingsView";
import { WidgetGalleryModal } from "./WidgetGalleryModal";

import * as SystemService from "@/../bindings/workpet/pkg/system/service";
import * as ActivityService from "@/../bindings/workpet/pkg/tools/activity/service";
import { initThemeListener } from "@/lib/theme";
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

  // 系统配置状态
  const [settings, setSettings] = useState({
    autostart: false,
    autostartStatus: false,
    autoHideWidget: true,
    globalShortcut: "CmdOrCtrl+Shift+R",
    enabledTools: ["activity", "datetime"],
    dashboardWidgets: [
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

  // 1. 初始化拉取后端配置与统计数据及外观主题
  useEffect(() => {
    initThemeListener();

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

    // 2. 监听事件实时更新（强类型订阅契约）
    const unbindStats = subscribeEvent<ActivityStatsPayload>(
      APP_EVENTS.ACTIVITY_STATS_UPDATE,
      (data) => setStats(data)
    );

    const unbindTick = subscribeEvent<ReminderTickPayload>(
      APP_EVENTS.REMINDER_TICK,
      (data) => setReminderState(data)
    );

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
    <ClickSpark sparkColor="var(--primary)" sparkSize={7} sparkRadius={18} sparkCount={6}>
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
                className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] border border-[#e0443e] flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                title="关闭/隐藏窗口 (Cmd+W)"
              >
                <X size={8} className="opacity-0 group-hover/traffic:opacity-100 text-black font-bold" />
              </button>
              <button
                onClick={() => SystemService.MinimizeDashboard()}
                className="w-3.5 h-3.5 rounded-full bg-[#febc2e] border border-[#d89e24] flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                title="最小化窗口"
              >
                <Minus size={8} className="opacity-0 group-hover/traffic:opacity-100 text-black font-bold" />
              </button>
              <button
                onClick={() => SystemService.OpenWidget()}
                className="w-3.5 h-3.5 rounded-full bg-[#28c840] border border-[#1aab29] flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
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
                  color="var(--foreground)"
                  shineColor="var(--primary)"
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

          {/* 右侧辅助操作：外观明暗切换 + 唤出随行挂件 */}
          <div
            style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
            className="flex items-center gap-2.5"
          >
            {/* 白天 / 黑夜 / 跟随系统 模式切换按钮 */}
            <ThemeToggle />

            {/* 打开随行挂件 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => SystemService.OpenWidget()}
              className="flex items-center gap-1.5 text-xs text-foreground border-border bg-card hover:bg-accent px-2.5 py-1.5"
              title="置顶唤醒桌面迷你随行挂件"
            >
              <ExternalLink size={13} className="text-primary" />
              <span>随行挂件</span>
            </Button>
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
