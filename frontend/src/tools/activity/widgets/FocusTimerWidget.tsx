/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：专注时钟半圆仪表盘（Radial Semi-Circle Gauge），规范内边距与大圆环，彻底去除琐碎计数器与冗余文字
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
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BellRing,
  Moon,
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
  const [localState, setLocalState] = useState<any>(propState || {});

  useEffect(() => {
    if (propState) {
      setLocalState(propState);
    }
  }, [propState]);

  const state = localState || {};
  const elapsedSecs = Math.max(0, state.elapsedSeconds ?? 0);
  const intervalMins = Math.max(1, state.intervalMinutes ?? 30);
  const totalTargetSecs = intervalMins * 60;
  const progressPercent = Math.min(100, Math.round((elapsedSecs / totalTargetSecs) * 100));
  const progressRatio = progressPercent / 100;

  const isReminding = !!state.isReminding;
  const isOffDuty = !!state.isOffDuty;
  const isAway = !!state.isAway && !isOffDuty;
  const isPaused = !!state.isPaused && !isReminding;

  // 弧线状态颜色
  const strokeColor = isReminding
    ? "hsl(var(--destructive))"
    : isPaused
    ? "hsl(38 92% 50%)"
    : isAway
    ? "hsl(var(--state-away))"
    : "hsl(var(--primary))";

  // 半圆几何常数：半径 64，半圆周长 201.06
  const ARC_LENGTH = 201.06;
  const strokeDashoffset = ARC_LENGTH * (1 - progressRatio);

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
      {/* 头部：与全天走势/时间转换严格平齐统一的 Header 与内边距规范 */}
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

        {/* 右侧：精简控制按钮与状态微标 */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Badge
            variant="secondary"
            className="text-xs font-mono px-2 py-0.5 border border-border bg-secondary text-secondary-foreground"
          >
            {intervalMins}m
          </Badge>

          {/* 快捷操作微按钮 */}
          {!isReminding && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleTogglePause}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                title={isPaused ? "继续专注" : "暂停专注"}
              >
                {isPaused ? <Play className="size-3.5 text-primary" /> : <Pause className="size-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleReset}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                title="重置当前周期"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={handleOpenWidget}
            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="唤起桌面独立迷你随行挂件"
          >
            <ExternalLink className="size-3.5 text-primary" />
          </Button>
        </div>
      </CardHeader>

      {/* 主体核心：超大半圆拱形仪表盘 (Semi-Circle Gauge) */}
      <CardContent className="p-0 flex-1 flex flex-col items-center justify-center relative min-h-0 pt-1">
        <div className="relative w-full h-[100px] flex items-center justify-center">
          <svg
            viewBox="0 0 200 102"
            className="w-full h-full overflow-visible"
          >
            {/* 1. 背景静音轨道（完整上半圆拱门） */}
            <path
              d="M 36 90 A 64 64 0 0 1 164 90"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
              className="opacity-60"
            />

            {/* 2. 前景彩色动态进度弧（平滑生长） */}
            <path
              d="M 36 90 A 64 64 0 0 1 164 90"
              stroke={strokeColor}
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease",
              }}
            />
          </svg>

          {/* 拱心核心指标：大字与纯净标签 */}
          <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center justify-center pointer-events-none select-none">
            {isReminding ? (
              <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
                <span className="text-xl font-black text-destructive animate-pulse leading-none">
                  该休息了
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleAcknowledge}
                  className="h-6 px-3 text-xs flex items-center gap-1 shadow-sm font-semibold rounded-full"
                >
                  <Coffee className="size-3" />
                  <span>确认休息</span>
                </Button>
              </div>
            ) : (
              <>
                <span
                  className={cn(
                    "text-3xl font-black font-mono tracking-tight leading-none",
                    isPaused
                      ? "text-amber-500"
                      : isAway
                      ? "text-state-away"
                      : "text-foreground"
                  )}
                >
                  {progressPercent}%
                </span>
                <span className="text-xs text-muted-foreground font-medium mt-1 leading-none">
                  {isPaused
                    ? "已暂停"
                    : isAway
                    ? "物理离座中"
                    : isOffDuty
                    ? "午休/下班"
                    : "已专注"}
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
