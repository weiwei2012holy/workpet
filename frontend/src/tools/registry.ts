/**
 * @Author wei
 * @Date 2026-11-04
 * @Description 前端工具与指标小组件（Widget）注册表，支持手机桌面式小组件即插即用
 **/

import React from "react";
import { TodayFocusWidget } from "./activity/widgets/TodayFocusWidget";
import { TodayRestWidget } from "./activity/widgets/TodayRestWidget";
import { HourlyTrendWidget } from "./activity/widgets/HourlyTrendWidget";
import { ActivityStatusWidget } from "./activity/widgets/ActivityStatusWidget";
import { DateConverterWidget } from "./datetime/DateConverterWidget";

// 工具定义模型
export interface ToolDefinition {
  id: string;              // 唯一工具标识
  name: string;            // 工具中文名称
  icon: string;            // 工具图标 (Emoji 或 SVG)
  description: string;     // 简短功能描述
  defaultEnabled: boolean; // 默认是否开启
  category: "efficiency" | "health" | "utility"; // 分类
  status: "active" | "coming_soon"; // 工具实装状态：active=已实装支持，coming_soon=规划中
}

// 指标小组件定义（手机桌面卡片式组件）
export interface MetricWidgetDefinition {
  id: string;                  // 如 'activity-focus-today'
  toolId: string;              // 归属工具 ID
  title: string;               // 小组件标题
  description: string;         // 小组件功能简述
  size: "1x1" | "2x1" | "2x2"; // 网格尺寸规格
  icon?: string;               // 图标标识
  render: (props: any) => React.ReactElement; // 动态渲染函数
}

// 当前已注册的系统工具库
export const REGISTERED_TOOLS: ToolDefinition[] = [
  {
    id: "activity",
    name: "活动与专注",
    icon: "🧘",
    description: "硬件级键鼠物理感知、科学作息提醒与全天专注走势追踪",
    defaultEnabled: true,
    category: "health",
    status: "active",
  },
  {
    id: "datetime",
    name: "时间戳与日期转换",
    icon: "🕒",
    description: "开发调试必备的时间戳与多格式日期双向实时互转工具，支持秒/毫秒及常用SQL时间生成",
    defaultEnabled: true,
    category: "utility",
    status: "active",
  },
  {
    id: "clipboard",
    name: "剪贴板百宝箱",
    icon: "📋",
    description: "历史剪贴板自动快照、格式清理与常用模版片段库",
    defaultEnabled: false,
    category: "efficiency",
    status: "coming_soon",
  },
  {
    id: "pomodoro",
    name: "番茄时钟",
    icon: "🍅",
    description: "标准番茄工作法管理、白噪音与专注阶段效率报告",
    defaultEnabled: false,
    category: "efficiency",
    status: "coming_soon",
  },
  {
    id: "quicknote",
    name: "灵感便签",
    icon: "📝",
    description: "桌面轻便备忘录、Markdown 支持与待办轻打卡",
    defaultEnabled: false,
    category: "utility",
    status: "coming_soon",
  },
];

// 当前已注册的指标小组件注册表
export const REGISTERED_METRIC_WIDGETS: MetricWidgetDefinition[] = [
  {
    id: "activity-focus-today",
    toolId: "activity",
    title: "今日专注时长",
    description: "统计当日累计专注工作时间与目标达成进度",
    size: "1x1",
    icon: "⏱️",
    render: (props) =>
      React.createElement(TodayFocusWidget, {
        minutes: props.stats?.todayFocusMinutes ?? 0,
      }),
  },
  {
    id: "activity-rest-today",
    toolId: "activity",
    title: "今日休息与拉伸",
    description: "记录今日离座放松次数与累计休息时长",
    size: "1x1",
    icon: "☕️",
    render: (props) =>
      React.createElement(TodayRestWidget, {
        restMinutes: props.stats?.todayRestMinutes ?? 0,
        restCount: props.stats?.restCount ?? 0,
      }),
  },
  {
    id: "activity-trend",
    toolId: "activity",
    title: "24小时专注走势图",
    description: "按小时可视化展示当日全天活跃专注时间分布波形柱状图",
    size: "2x1",
    icon: "📈",
    render: (props) =>
      React.createElement(HourlyTrendWidget, {
        hourlyFocus: props.stats?.hourlyFocus ?? [],
      }),
  },
  {
    id: "activity-status",
    toolId: "activity",
    title: "实时物理状态感知",
    description: "微秒级键鼠操作传感器与当前工作/休息状态监控",
    size: "1x1",
    icon: "📡",
    render: (props) =>
      React.createElement(ActivityStatusWidget, {
        currentState: props.stats?.currentState ?? "working",
        currentIdleSeconds: props.reminderState?.currentIdleSeconds ?? 0,
        idleThresholdMinutes: props.reminderState?.idleThresholdMinutes ?? 3,
      }),
  },
  {
    id: "datetime-quick",
    toolId: "datetime",
    title: "时间戳快捷转换",
    description: "实时显示当前秒/毫秒时间戳，支持贴入时间戳或日期一键直观互转",
    size: "1x1",
    icon: "🕒",
    render: () => React.createElement(DateConverterWidget, {}),
  },
];
