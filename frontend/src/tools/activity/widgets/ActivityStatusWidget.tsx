/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 仪表盘指标小组件：当前感知状态，增加午休/下班长时间离座状态展示，采用 shadcn/ui Card 完整复合结构与官方 Progress 组件重构
 **/

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, ShieldCheck, Moon } from "lucide-react";

interface ActivityStatusWidgetProps {
  currentState?: string; // "working" | "reminding" | "away" | "paused" | "offduty"
  currentIdleSeconds?: number;
  idleThresholdMinutes?: number;
}

export const ActivityStatusWidget: React.FC<ActivityStatusWidgetProps> = ({
  currentState = "working",
  currentIdleSeconds = 0,
  idleThresholdMinutes = 3,
}) => {
  const thresholdSeconds = idleThresholdMinutes * 60;
  const isOffDuty = currentState === "offduty";
  const idleRatio = isOffDuty
    ? 100
    : Math.min(100, Math.round((currentIdleSeconds / thresholdSeconds) * 100));

  const getStateMeta = () => {
    switch (currentState) {
      case "offduty":
        return {
          title: "午休 / 下班",
          dotColor: "bg-state-offduty",
          badgeVariant: "secondary" as const,
          iconColor: "text-state-offduty",
          bgIcon: "bg-state-offduty/15 border-state-offduty/25",
        };
      case "reminding":
        return {
          title: "提醒休息",
          dotColor: "bg-state-alerting",
          badgeVariant: "destructive" as const,
          iconColor: "text-state-alerting",
          bgIcon: "bg-state-alerting/15 border-state-alerting/25",
        };
      case "away":
        return {
          title: "离座中",
          dotColor: "bg-state-away",
          badgeVariant: "away" as const,
          iconColor: "text-state-away",
          bgIcon: "bg-state-away/15 border-state-away/25",
        };
      case "paused":
        return {
          title: "已暂停",
          dotColor: "bg-state-paused",
          badgeVariant: "secondary" as const,
          iconColor: "text-state-paused",
          bgIcon: "bg-state-paused/15 border-state-paused/25",
        };
      default:
        return {
          title: "专注中",
          dotColor: "bg-state-ready",
          badgeVariant: "success" as const,
          iconColor: "text-state-ready",
          bgIcon: "bg-state-ready/15 border-state-ready/25",
        };
    }
  };

  const meta = getStateMeta();

  return (
    <Card className="flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm hover:border-state-ready/50 transition-all">
      {/* 头部：CardHeader 与 CardTitle 复合规范 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className={`size-8 rounded-lg border flex items-center justify-center ${meta.bgIcon} ${meta.iconColor}`}>
            {isOffDuty ? <Moon className="size-4.5" /> : <Activity className="size-4.5" />}
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            当前状态
          </CardTitle>
        </div>

        <Badge variant={meta.badgeVariant} className="flex items-center gap-1.5 text-xs px-2.5 py-0.5">
          <span className={`size-2 rounded-full ${meta.dotColor} animate-pulse`} />
          <span>{meta.title}</span>
        </Badge>
      </CardHeader>

      {/* 核心指标值：直观大号时间 */}
      <CardContent className="p-0 my-auto py-1">
        {isOffDuty ? (
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-extrabold tracking-tight text-state-offduty">
              {Math.floor(currentIdleSeconds / 60)}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">分钟空闲 · 不计入统计</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">
              {currentIdleSeconds}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">秒无操作 / {thresholdSeconds}s 阈值</span>
          </div>
        )}
      </CardContent>

      {/* 底部使用官方 Progress 与 CardFooter 规范 */}
      <CardFooter className="p-0 border-none mt-0 flex flex-col gap-2">
        <Progress value={idleRatio} className="h-2" />
        <div className="flex justify-between w-full text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3 text-primary" />
            {isOffDuty ? "已判定为非工作时间" : "自动感知"}
          </span>
          <span>{isOffDuty ? "午休/下班离岗" : `${idleThresholdMinutes} 分钟`}</span>
        </div>
      </CardFooter>
    </Card>
  );
};
