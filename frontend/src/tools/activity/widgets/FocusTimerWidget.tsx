/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：专注时钟 chart-radial-stacked 双色堆叠半圆仪表盘，彻底移除标题文字，操作按钮沉底居中
 **/

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
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

  // 双色堆叠颜色配置（已专注深色段 vs 剩余浅色段）
  const activeColor = isReminding
    ? "hsl(var(--destructive))"
    : isPaused
    ? "hsl(38 92% 50%)"
    : isAway
    ? "hsl(var(--state-away))"
    : "hsl(var(--primary))";

  const remainingColor = isReminding
    ? "hsl(var(--destructive) / 0.25)"
    : isPaused
    ? "hsl(38 92% 50% / 0.25)"
    : "hsl(var(--primary) / 0.22)";

  // 半圆周长 (半径 R = 64)
  const ARC_LENGTH = 201.06;
  const activeLength = Math.max(0.1, ARC_LENGTH * progressRatio);
  const remainingLength = Math.max(0.1, ARC_LENGTH * (1 - progressRatio));

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
        "flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm transition-all select-none relative overflow-hidden",
        isReminding
          ? "border-destructive/60 bg-destructive/5 hover:border-destructive animate-pulse"
          : isPaused
          ? "hover:border-amber-500/50"
          : isAway
          ? "hover:border-state-away/50"
          : "hover:border-primary/50"
      )}
    >
      {/* 核心主视觉：chart-radial-stacked 双色堆叠半圆拱门仪表盘 */}
      <CardContent className="p-0 flex-1 flex flex-col items-center justify-center relative min-h-0 pt-0.5">
        <div className="relative w-full h-[96px] flex items-center justify-center">
          <svg
            viewBox="0 0 200 98"
            className="w-full h-full overflow-visible"
          >
            {/* 1. 双色堆叠后段：剩余时间浅色段 (从进度落点延伸至右侧终点 164) */}
            <path
              d="M 36 88 A 64 64 0 0 1 164 88"
              stroke={remainingColor}
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${remainingLength} ${ARC_LENGTH}`}
              strokeDashoffset={-activeLength}
              style={{
                transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease",
              }}
            />

            {/* 2. 双色堆叠前段：已专注高亮深色段 (从左侧起点 36 顺时针延伸) */}
            <path
              d="M 36 88 A 64 64 0 0 1 164 88"
              stroke={activeColor}
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${activeLength} ${ARC_LENGTH}`}
              strokeDashoffset="0"
              style={{
                transition: "stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease",
              }}
            />
          </svg>

          {/* 拱门核心指标：大字与纯净标签 */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span
              className={cn(
                "text-3xl font-black font-mono tracking-tight leading-none",
                isReminding
                  ? "text-destructive animate-pulse"
                  : isPaused
                  ? "text-amber-500"
                  : isAway
                  ? "text-state-away"
                  : "text-foreground"
              )}
            >
              {progressPercent}%
            </span>
            <span className="text-[11px] text-muted-foreground font-medium mt-1 leading-none">
              {isReminding
                ? "该休息了"
                : isPaused
                ? "已暂停"
                : isAway
                ? "离座中"
                : isOffDuty
                ? "午休/下班"
                : "已专注"}
            </span>
          </div>
        </div>
      </CardContent>

      {/* 底部居中操作区：纯粹轻量的小控制栏 */}
      <div
        className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/40"
        onClick={(e) => e.stopPropagation()}
      >
        {isReminding ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleAcknowledge}
            className="h-6.5 px-3 text-xs flex items-center gap-1.5 shadow-sm font-semibold rounded-full"
          >
            <Coffee className="size-3" />
            <span>确认休息</span>
          </Button>
        ) : (
          <>
            <Badge
              variant="secondary"
              className="text-[11px] font-mono px-2 py-0.5 border border-border/60 bg-muted/60 text-muted-foreground"
            >
              {intervalMins}m
            </Badge>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleTogglePause}
              className={cn(
                "size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
                isPaused && "text-amber-500 bg-amber-500/15 hover:bg-amber-500/25"
              )}
              title={isPaused ? "继续专注" : "暂停专注"}
            >
              {isPaused ? <Play className="size-3 text-primary" /> : <Pause className="size-3" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleReset}
              className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="重置当前周期"
            >
              <RotateCcw className="size-3" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleOpenWidget}
              className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="唤起桌面独立迷你随行挂件"
            >
              <ExternalLink className="size-3 text-primary" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};
