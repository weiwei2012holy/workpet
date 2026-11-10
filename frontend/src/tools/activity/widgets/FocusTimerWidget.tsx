/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：专注时钟，100% 严格遵循全局三段式卡片规范与 RGB 色彩体系，落地 chart-radial-stacked 双色半圆拱门
 **/

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
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

  // 100% 严格配套全局 index.css 与 tailwind.config.js 的 RGB 通道色彩规范（杜绝非法 hsl 导致透明）
  const activeColor = isReminding
    ? "rgb(var(--destructive))"
    : isPaused
    ? "rgb(245 158 11)" // 琥珀橙
    : isAway
    ? "rgb(var(--state-away))"
    : "rgb(var(--primary))";

  const remainingColor = isReminding
    ? "rgb(var(--destructive) / 0.18)"
    : isPaused
    ? "rgb(245 158 11 / 0.18)"
    : "rgb(var(--primary) / 0.16)";

  // 半圆几何计算：半径 R = 54，半圆周长 L = PI * 54 = 169.65
  const ARC_LENGTH = 169.65;
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
      {/* 1. 规范头部：与时间转换、全天走势 100% 像素级对齐一致 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
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
          <CardTitle className="text-base font-semibold text-foreground">
            专注时钟
          </CardTitle>
        </div>

        {/* 右侧：状态 Badge 与随行挂件外跳按钮 */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Badge
            variant="outline"
            className="text-xs font-mono px-2.5 py-0.5 bg-secondary text-secondary-foreground border-border"
          >
            {intervalMins}m
          </Badge>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleOpenWidget}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            title="唤起桌面独立随行挂件"
          >
            <ExternalLink className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>

      {/* 2. 主体区：chart-radial-stacked 双色堆叠半圆拱门仪表盘 */}
      <CardContent className="p-0 my-auto py-0 flex flex-col items-center justify-center relative min-h-0">
        <div className="relative w-full h-[84px] flex items-center justify-center">
          <svg
            viewBox="0 0 200 84"
            className="w-full h-full overflow-visible"
          >
            {/* 堆叠后段：剩余时间柔和浅色段 (从专注落点延续至终点 154) */}
            <path
              d="M 46 76 A 54 54 0 0 1 154 76"
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

            {/* 堆叠前段：已专注高亮深色段 (从起点 46 顺时针延伸) */}
            <path
              d="M 46 76 A 54 54 0 0 1 154 76"
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

          {/* 拱心核心大字数字 */}
          <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center justify-center pointer-events-none select-none">
            <span
              className={cn(
                "text-2xl font-black font-mono tracking-tight leading-none",
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
      </CardContent>

      {/* 3. 规范底部：左侧实时状态指示 + 右侧快捷操作按钮（与其他卡片底部完全水平齐平） */}
      <CardFooter className="p-0 border-none mt-0 flex items-center justify-between text-xs text-muted-foreground select-none">
        {/* 左侧：微型状态指示灯（对齐时间转换与全天走势的实时指示点） */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {isReminding ? (
            <span className="flex items-center gap-1.5 text-destructive font-semibold">
              <span className="size-1.5 rounded-full bg-destructive animate-ping" />
              <span>建议休息</span>
            </span>
          ) : isPaused ? (
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>已暂停</span>
            </span>
          ) : isAway ? (
            <span className="flex items-center gap-1.5 text-state-away">
              <span className="size-1.5 rounded-full bg-state-away" />
              <span>物理离座</span>
            </span>
          ) : isOffDuty ? (
            <span className="flex items-center gap-1.5 text-state-offduty">
              <span className="size-1.5 rounded-full bg-state-offduty" />
              <span>免打扰</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span>专注中</span>
            </span>
          )}
        </div>

        {/* 右侧：操作按钮（暂停/继续、重置） */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isReminding ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleAcknowledge}
              className="h-6 px-2.5 text-[11px] flex items-center gap-1 shadow-sm font-semibold rounded-md"
            >
              <Coffee className="size-3" />
              <span>确认休息</span>
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleTogglePause}
                className={cn(
                  "size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
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
                className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="重置当前周期"
              >
                <RotateCcw className="size-3" />
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
