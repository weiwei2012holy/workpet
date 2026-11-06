/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 全局事件总线契约模块，统一定义事件名称、载荷（Payload）强类型接口与安全解析订阅工具
 **/

import { Events } from "@wailsio/runtime";
import { ActivityStats, ReminderState } from "@/../bindings/workpet/pkg/tools/activity/models";
import { UpdateInfo } from "@/../bindings/workpet/pkg/updater/models";

// ==================== 事件名称常量契约 ====================
export const APP_EVENTS = {
  // 活动感知与专注统计实时刷新
  ACTIVITY_STATS_UPDATE: "activity:stats-update",

  // 提醒时钟心跳跳动（每秒）
  REMINDER_TICK: "reminder:tick",

  // 离座归位欢迎事件
  REMINDER_RETURNED: "reminder:returned",

  // 窗口由后端唤起显示事件
  WINDOW_SHOWN: "reminder:window-shown",

  // 自动淡出隐藏请求事件
  REQUEST_FADE_OUT: "reminder:request-fade-out",

  // 看板指标小组件排布变动
  DASHBOARD_WIDGETS_CHANGED: "settings:dashboard-widgets-changed",

  // 工具箱插件启闭变动
  TOOLS_CHANGED: "settings:tools-changed",

  // 应用在线自更新状态推送
  UPDATER_STATUS: "workpet:updater:status",
} as const;

// ==================== 事件载荷（Payload）类型定义 ====================
export interface ToolChangedPayload {
  toolId: string;
  enabled: boolean;
}

export type DashboardWidgetsPayload = string[];
export type ActivityStatsPayload = ActivityStats;
export type ReminderTickPayload = ReminderState;
export type UpdaterStatusPayload = UpdateInfo;

// ==================== 统一载荷解包辅助函数 ====================

/**
 * 解包 Wails CustomEvent 载荷，消除各平台环境 evt?.data || evt 的不确定性
 */
export function unwrapEventPayload<T>(evt: any): T | null {
  if (evt === null || evt === undefined) return null;
  if (typeof evt === "object" && "data" in evt && evt.data !== undefined) {
    return evt.data as T;
  }
  return evt as T;
}

/**
 * 类型安全的全局事件监听订阅函数，自动完成载荷校验与解包
 * @param eventName 事件名称常量
 * @param handler 强类型处理回调
 * @returns 解绑函数
 */
export function subscribeEvent<T>(
  eventName: string,
  handler: (payload: T) => void
): () => void {
  const unbind = Events.On(eventName, (rawEvent: any) => {
    const payload = unwrapEventPayload<T>(rawEvent);
    if (payload !== null && payload !== undefined) {
      handler(payload);
    }
  });
  return unbind;
}
