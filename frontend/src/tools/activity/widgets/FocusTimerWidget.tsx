/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：专注时钟，保留左上角标志性ICON与右上角挂件，去除文字说明，状态点移至暂停重置按钮前
 **/

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

  // 严格配套 RGB 通道色彩规范（杜绝非法 hsl）
  const activeColor = isReminding
    ? "rgb(var(--destructive))"
    : isPaused
    ? "rgb(245 158 11)"
    : isAway
    ? "rgb(var(--state-away))"
    : "rgb(var(--primary))";

  const remainingColor = isReminding
    ? "rgb(var(--destructive) / 0.18)"
    : isPaused
    ? "rgb(245 158 11 / 0.18)"
    : "rgb(var(--primary) / 0.16)";

  // 半圆几何参数：半径 R = 60，全半圆周长 L = PI * 60 = 188.5
  const ARC_LENGTH = 188.5;
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
      {/* 1. 顶部：保留标志性家族 ICON 与右上角随行挂件外跳按钮（去除文字） */}
      <div className="flex items-center justify-between w-full z-10">
        <div
          className={cn(
            "size-8 rounded-lg flex items-center justify-center transition-colors",
            isReminding
              ? "bg-destructive/15 text-destructive border border-destructive/25"
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

        <Button
          size="icon"
          variant="ghost"
          onClick={handleOpenWidget}
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          title="置顶唤起桌面独立迷你挂件"
        >
          <ExternalLink className="size-4 text-muted-foreground" />
        </Button>
      </div>

      {/* 2. 主体核心：chart-radial-stacked 双色堆叠半圆拱门 */}
      <CardContent className="p-0 flex-1 flex flex-col items-center justify-center relative min-h-0 pt-0.5">
        <div className="relative w-full h-[84px] flex items-center justify-center">
          <svg
            viewBox="0 0 200 84"
            className="w-full h-full overflow-visible"
          >
            {/* 堆叠后段：剩余时间浅色段 (从专注落点延续至终点 160) */}
            <path
              d="M 40 76 A 60 60 0 0 1 160 76"
              stroke={remainingColor}
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${remainingLength} ${ARC_LENGTH}`}
              strokeDashoffset={-activeLength}
              style={{
                transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* 堆叠前段：已专注高亮深色段 (从起点 40 顺时针延伸) */}
            <path
              d="M 40 76 A 60 60 0 0 1 160 76"
              stroke={activeColor}
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${activeLength} ${ARC_LENGTH}`}
              strokeDashoffset="0"
              style={{
                transition: "stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease",
              }}
            />
          </svg>

          {/* 拱门核心大字数字 */}
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
          </div>
        </div>

        {/* 3. 圆环正下方：状态指示点 + 暂停/继续 + 重置（整合在同一水平排） */}
        <div
          className="flex items-center justify-center gap-2 mt-1.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {isReminding ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleAcknowledge}
              className="h-7 px-3 text-xs flex items-center gap-1.5 shadow-sm font-semibold rounded-full"
            >
              <Coffee className="size-3.5" />
              <span>确认休息</span>
            </Button>
          ) : (
            <>
              {/* 专注状态指示点：放置在暂停/重置按钮前面 */}
              <div
                className="flex items-center justify-center mr-1"
                title={isPaused ? "已暂停" : isAway ? "物理离座" : isOffDuty ? "免打扰" : "专注中"}
              >
                {isPaused ? (
                  <span className="size-2 rounded-full bg-amber-500" />
                ) : isAway ? (
                  <span className="size-2 rounded-full bg-state-away" />
                ) : isOffDuty ? (
                  <span className="size-2 rounded-full bg-state-offduty" />
                ) : (
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex rounded-full size-2 bg-primary" />
                  </span>
                )}
              </div>

              {/* 暂停 / 继续按钮 */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleTogglePause}
                className={cn(
                  "size-7 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all",
                  isPaused && "text-amber-500 bg-amber-500/15 hover:bg-amber-500/25"
                )}
                title={isPaused ? "继续专注" : "暂停专注"}
              >
                {isPaused ? <Play className="size-3.5 text-primary" /> : <Pause className="size-3.5" />}
              </Button>

              {/* 重置当前周期按钮 */}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleReset}
                className="size-7 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                title="重置当前周期"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
