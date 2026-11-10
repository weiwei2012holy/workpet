/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：专注时钟（左右分栏方案：左侧 360 度圆环倒计时 + 右侧呼吸状态胶囊与双大圆形按钮，支持双击卡片打开挂件）
 **/

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
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
  
  // 倒计时剩余秒数与格式化
  const remainingSecs = Math.max(0, totalTargetSecs - elapsedSecs);
  const remMins = Math.floor(remainingSecs / 60);
  const remSecs = remainingSecs % 60;
  const timeFormatted = `${String(remMins).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`;

  // 进度比例 (0 ~ 1)
  const progressRatio = Math.min(1, Math.max(0, elapsedSecs / totalTargetSecs));

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

  const trackColor = isReminding
    ? "rgb(var(--destructive) / 0.16)"
    : isPaused
    ? "rgb(245 158 11 / 0.16)"
    : "rgb(var(--primary) / 0.16)";

  // 360 度圆环几何参数：半径 R = 48，圆周长 C = 2 * PI * 48 ≈ 301.59
  const CIRCUMFERENCE = 301.59;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progressRatio);

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

  // 双击卡片快速打开独立挂件
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
      onDoubleClick={handleOpenWidget}
      title="双击打开桌面独立迷你挂件"
      className={cn(
        "flex items-center h-[180px] p-5 border-border bg-card shadow-sm transition-all select-none relative overflow-hidden cursor-default",
        isReminding
          ? "border-destructive/60 bg-destructive/5 hover:border-destructive animate-pulse"
          : isPaused
          ? "hover:border-amber-500/50"
          : isAway
          ? "hover:border-state-away/50"
          : "hover:border-primary/50"
      )}
    >
      <div className="flex items-center justify-between gap-4 w-full h-full">
        {/* 左侧：360度正圆进度环 + 倒计时时间 + 状态微标 */}
        <div className="relative size-[124px] flex-shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            {/* 底轨圆环 */}
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke={trackColor}
              strokeWidth="10"
              fill="none"
            />
            {/* 动态高亮进度弧（顺时针） */}
            <circle
              cx="60"
              cy="60"
              r="48"
              stroke={activeColor}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition:
                  "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease",
              }}
            />
          </svg>

          {/* 环心正中内容 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span
              className={cn(
                "text-2xl font-black font-mono tracking-tight",
                isReminding
                  ? "text-destructive animate-pulse"
                  : isPaused
                  ? "text-amber-500"
                  : isAway
                  ? "text-state-away"
                  : "text-foreground"
              )}
            >
              {timeFormatted}
            </span>
            <div
              className={cn(
                "mt-0.5 flex items-center justify-center",
                isReminding
                  ? "text-destructive"
                  : isPaused
                  ? "text-amber-500"
                  : "text-primary/70"
              )}
            >
              {isPaused ? (
                <Play className="size-3 fill-current ml-0.5" />
              ) : (
                <Pause className="size-3 fill-current" />
              )}
            </div>
          </div>
        </div>

        {/* 中间：竖向细分割线 */}
        <Separator orientation="vertical" className="h-20 bg-border/60 self-center" />

        {/* 右侧：状态呼吸胶囊 + 大圆形操作按钮（居中对齐，严丝合缝） */}
        <div className="flex-1 flex flex-col items-center justify-center h-full min-w-0">
          <div className="flex flex-col items-center justify-center gap-3.5">
            {/* 状态展示：内嵌呼吸微动效小圆点的状态胶囊 */}
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors",
                isReminding
                  ? "bg-destructive/15 text-destructive border border-destructive/25"
                  : isPaused
                  ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                  : isAway
                  ? "bg-state-away/15 text-state-away border border-state-away/25"
                  : isOffDuty
                  ? "bg-state-offduty/15 text-state-offduty border border-state-offduty/25"
                  : "bg-primary/15 text-primary border border-primary/25"
              )}
            >
              {/* 状态指示点：带柔和平缓呼吸动画 (2.5s 慢周期，不晃眼) */}
              {isPaused ? (
                <span className="size-2 rounded-full bg-amber-500" />
              ) : isAway ? (
                <span className="size-2 rounded-full bg-state-away" />
              ) : isOffDuty ? (
                <span className="size-2 rounded-full bg-state-offduty" />
              ) : isReminding ? (
                <span className="relative flex size-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"
                    style={{ animation: "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                  />
                  <span className="relative inline-flex rounded-full size-2 bg-destructive" />
                </span>
              ) : (
                <span className="relative flex size-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"
                    style={{ animation: "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                  />
                  <span className="relative inline-flex rounded-full size-2 bg-primary" />
                </span>
              )}

              <span>
                {isReminding
                  ? "该休息了"
                  : isPaused
                  ? "已暂停"
                  : isAway
                  ? "离座中"
                  : isOffDuty
                  ? "免打扰"
                  : "专注中"}
              </span>
            </div>

            {/* 控制按钮区 */}
            <div className="flex items-center gap-3.5">
              {isReminding ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleAcknowledge}
                  className="h-11 px-5 text-xs flex items-center gap-2 shadow-md font-semibold rounded-full justify-center"
                >
                  <Coffee className="size-4" />
                  <span>确认休息</span>
                </Button>
              ) : (
                <>
                  {/* 主操作按钮：大圆高饱和度按钮 */}
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={cn(
                      "size-12 rounded-full flex items-center justify-center text-primary-foreground shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer",
                      isPaused
                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/25"
                        : "bg-primary hover:bg-primary/90 shadow-primary/25"
                    )}
                    title={isPaused ? "继续专注" : "暂停专注"}
                  >
                    {isPaused ? (
                      <Play className="size-5 fill-current ml-0.5" />
                    ) : (
                      <Pause className="size-5 fill-current" />
                    )}
                  </button>

                  {/* 次级操作按钮：大圆柔和淡紫重置按钮 */}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="size-12 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="重置当前周期"
                  >
                    <RotateCcw className="size-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
