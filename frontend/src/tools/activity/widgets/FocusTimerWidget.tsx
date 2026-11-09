/**
 * @Author wei
 * @Date 2026-11-09
 * @Description 仪表盘指标小组件：实时专注倒计时时钟，支持在指标看板中实时倒计时、专注进度呈现、唤起桌面随行挂件与快捷暂停/重置/确认休息操作
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
import { Progress } from "@/components/ui/progress";
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
      className={`flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm transition-all select-none ${
        isReminding
          ? "border-destructive/60 bg-destructive/5 hover:border-destructive animate-pulse"
          : isPaused
          ? "hover:border-amber-500/50"
          : isAway
          ? "hover:border-state-away/50"
          : "hover:border-primary/50"
      }`}
    >
      {/* 头部：标题、状态 Badge 与呼出挂件按钮 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div
            className={`size-8 rounded-lg flex items-center justify-center transition-colors ${
              isReminding
                ? "bg-destructive/15 text-destructive border border-destructive/30"
                : isOffDuty
                ? "bg-state-offduty/15 text-state-offduty border border-state-offduty/25"
                : isAway
                ? "bg-state-away/15 text-state-away border border-state-away/25"
                : isPaused
                ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                : "bg-primary/15 text-primary border border-primary/25"
            }`}
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

      {/* 核心大字倒计时区 */}
      <CardContent className="p-0 my-auto py-1">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2 font-mono">
            <span
              className={`text-3xl font-extrabold tracking-tight ${
                isReminding
                  ? "text-destructive"
                  : isPaused
                  ? "text-amber-500"
                  : isAway
                  ? "text-state-away"
                  : "text-foreground"
              }`}
            >
              {isReminding ? "00:00" : timeFormatted}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              / {intervalMins}m
            </span>
          </div>

          {/* 快捷操作按钮组 */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isReminding ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleAcknowledge}
                className="h-7 px-2.5 text-xs flex items-center gap-1 shadow-sm font-semibold"
                title="已起立休息，开始下一轮专注"
              >
                <Coffee className="size-3.5" />
                <span>确认休息</span>
              </Button>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleTogglePause}
                  className="size-7 rounded-lg border-border hover:bg-muted text-foreground"
                  title={isPaused ? "继续倒计时" : "暂停倒计时"}
                >
                  {isPaused ? <Play className="size-3.5 text-primary" /> : <Pause className="size-3.5 text-muted-foreground" />}
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

      {/* 底部专注进度条与描述 */}
      <CardFooter className="p-0 border-none mt-0 flex flex-col gap-1.5">
        <Progress value={progressPercent} className="h-1.5" />
        <div className="flex justify-between w-full text-xs font-mono text-muted-foreground">
          <span>{isPaused ? "计时已暂停" : isAway ? "物理离座中" : `已专注 ${Math.floor(elapsedSecs / 60)} 分钟`}</span>
          <span>{progressPercent}%</span>
        </div>
      </CardFooter>
    </Card>
  );
};
