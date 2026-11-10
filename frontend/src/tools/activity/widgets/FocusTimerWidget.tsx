/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：实时专注倒计时时钟，基于 shadcn/ui Radial Chart 环形图重构，提供环形进度感知、时间大字展示与快捷操作
 **/

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BellRing,
  Moon,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as ActivityService from "@/../bindings/workpet/pkg/tools/activity/service";
import * as SystemService from "@/../bindings/workpet/pkg/system/service";

interface FocusTimerWidgetProps {
  reminderState?: any;
}

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  reminderState: propState,
}) => {
  // 本地同步状态，支持快速响应点击
  const [localState, setLocalState] = useState<any>(propState || {});

  useEffect(() => {
    if (propState) {
      setLocalState(propState);
    }
  }, [propState]);

  const state = localState || {};
  const remainingSecs = Math.max(0, state.remainingSeconds ?? 1800);
  const elapsedSecs = Math.max(0, state.elapsedSeconds ?? 0);
  const intervalMins = Math.max(1, state.intervalMinutes ?? 30);
  const totalTargetSecs = intervalMins * 60;
  const progressPercent = Math.min(100, Math.round((elapsedSecs / totalTargetSecs) * 100));

  const displayMins = Math.floor(remainingSecs / 60);
  const displaySecs = remainingSecs % 60;
  const timeFormatted = `${String(displayMins).padStart(2, "0")}:${String(displaySecs).padStart(2, "0")}`;

  const isReminding = !!state.isReminding;
  const isOffDuty = !!state.isOffDuty;
  const isAway = !!state.isAway && !isOffDuty;
  const isPaused = !!state.isPaused && !isReminding;

  // shadcn Chart 配置与动态主题色绑定
  const chartConfig = {
    progress: {
      label: "专注进度",
      color: isReminding
        ? "hsl(var(--destructive))"
        : isPaused
        ? "hsl(38 92% 50%)"
        : isAway
        ? "hsl(var(--state-away))"
        : "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  const chartData = [
    {
      name: "focus",
      value: progressPercent,
      fill: "var(--color-progress)",
    },
  ];

  // 操作响应
  const handleTogglePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ActivityService.TogglePause();
      const updated = await ActivityService.GetState();
      if (updated) setLocalState(updated);
    } catch (err) {
      console.error("切换专注暂停状态失败:", err);
    }
  };

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ActivityService.Reset();
      const updated = await ActivityService.GetState();
      if (updated) setLocalState(updated);
    } catch (err) {
      console.error("重置专注时钟失败:", err);
    }
  };

  const handleAcknowledge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ActivityService.Acknowledge();
      const updated = await ActivityService.GetState();
      if (updated) setLocalState(updated);
    } catch (err) {
      console.error("确认休息失败:", err);
    }
  };

  const handleOpenWidget = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await SystemService.OpenWidget();
    } catch (err) {
      console.error("打开桌面随行挂件失败:", err);
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm transition-all select-none",
        isReminding
          ? "border-destructive/60 bg-destructive/5 hover:border-destructive animate-pulse"
          : isPaused
          ? "hover:border-amber-500/50"
          : isAway
          ? "hover:border-state-away/50"
          : "hover:border-primary/50"
      )}
    >
      {/* 头部：标题、状态 Badge 与呼出挂件按钮 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "size-8 rounded-lg flex items-center justify-center transition-colors",
              isReminding
                ? "bg-destructive/15 text-destructive border border-destructive/30"
                : isOffDuty
                ? "bg-state-offduty/15 text-state-offduty border border-state-offduty/25"
                : isAway
                ? "bg-state-away/15 text-state-away border border-state-away/25"
                : isPaused
                ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                : "bg-primary/15 text-primary border border-primary/25"
            )}
          >
            {isReminding ? (
              <BellRing className="size-4.5 animate-bounce" />
            ) : isOffDuty ? (
              <Moon className="size-4.5" />
            ) : (
              <Timer className="size-4.5" />
            )}
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            专注时钟
          </CardTitle>
        </div>

        {/* 右侧状态徽标与唤出随行挂件按钮 */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isReminding ? (
            <Badge variant="destructive" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-mono animate-bounce">
              <span>该休息了</span>
            </Badge>
          ) : isOffDuty ? (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs px-2.5 py-0.5">
              <span>午休/下班</span>
            </Badge>
          ) : isAway ? (
            <Badge variant="away" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-mono">
              <Sparkles className="size-3" />
              <span>离座中</span>
            </Badge>
          ) : isPaused ? (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs px-2.5 py-0.5 text-amber-500 bg-amber-500/10 border-amber-500/20 font-mono">
              <span>已暂停</span>
            </Badge>
          ) : (
            <Badge variant="default" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-mono bg-primary/20 text-primary border border-primary/30">
              <span>周期 {intervalMins}m</span>
            </Badge>
          )}

          {/* 独立唤出随行挂件小按钮 */}
          <Button
            size="icon"
            variant="outline"
            onClick={handleOpenWidget}
            className="size-6 rounded-md border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground shadow-none"
            title="置顶唤醒桌面迷你随行挂件"
          >
            <ExternalLink className="size-3 text-primary" />
            <span className="sr-only">唤起随行挂件</span>
          </Button>
        </div>
      </CardHeader>

      {/* 主体内容：左侧 Radial Chart 环形进度仪表 + 右侧倒计时数字与快捷操作 */}
      <CardContent className="flex-1 flex items-center justify-between gap-3 p-0 pt-2 min-h-0">
        {/* 左侧：shadcn/ui 官方 Radial Chart 环形仪表 */}
        <div className="relative size-[94px] shrink-0 flex items-center justify-center">
          <ChartContainer
            config={chartConfig}
            className="size-[94px] aspect-square"
          >
            <RadialBarChart
              data={chartData}
              startAngle={90}
              endAngle={-270}
              innerRadius="72%"
              outerRadius="100%"
              barSize={7}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                dataKey="value"
                background={{ fill: "hsl(var(--muted)/0.5)" }}
                cornerRadius={4}
              />
            </RadialBarChart>
          </ChartContainer>

          {/* 环心绝对定位文字 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-base font-black font-mono tracking-tight text-foreground leading-none">
              {progressPercent}%
            </span>
            <span className="text-[10px] text-muted-foreground scale-90 mt-1 font-medium leading-none">
              已专注
            </span>
          </div>
        </div>

        {/* 右侧：倒计时大字时间、状态说明与快捷操作按钮组 */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          {/* 核心大字倒计时区 */}
          <div className="flex items-baseline gap-1.5 font-mono">
            <span
              className={cn(
                "text-2xl font-black tracking-tight",
                isReminding
                  ? "text-destructive animate-pulse"
                  : isPaused
                  ? "text-amber-500"
                  : isAway
                  ? "text-state-away"
                  : "text-foreground"
              )}
            >
              {isReminding ? "00:00" : timeFormatted}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              / {intervalMins}m
            </span>
          </div>

          {/* 状态辅助文案 */}
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {isReminding
              ? "该起立休息了"
              : isPaused
              ? "计时已暂停"
              : isAway
              ? "物理离座中"
              : `已专注 ${Math.floor(elapsedSecs / 60)} 分钟`}
          </p>

          {/* 快捷操作按钮组 */}
          <div
            className="flex items-center gap-1.5 mt-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            {isReminding ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleAcknowledge}
                className="h-7 px-3 text-xs flex items-center gap-1.5 font-semibold shadow-sm"
                title="已起立休息，开始下一轮专注"
              >
                <Coffee className="size-3.5" />
                <span>确认休息</span>
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant={isPaused ? "default" : "outline"}
                  onClick={handleTogglePause}
                  className={cn(
                    "h-7 px-2.5 text-xs flex items-center gap-1.5 rounded-lg border-border transition-all",
                    !isPaused && "hover:bg-muted text-foreground"
                  )}
                  title={isPaused ? "继续倒计时" : "暂停倒计时"}
                >
                  {isPaused ? (
                    <>
                      <Play className="size-3" />
                      <span>继续</span>
                    </>
                  ) : (
                    <>
                      <Pause className="size-3" />
                      <span>暂停</span>
                    </>
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleReset}
                  className="size-7 rounded-lg border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="重置当前专注周期"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
