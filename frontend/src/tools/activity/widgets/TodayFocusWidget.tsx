/**
 * @Author wei
 * @Date 2026-11-05
 * @Description 仪表盘指标小组件：今日专注，采用 shadcn/ui Card 完整复合结构与官方 Progress 组件重构
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
import { Clock, Flame } from "lucide-react";

interface TodayFocusWidgetProps {
  minutes: number;
}

export const TodayFocusWidget: React.FC<TodayFocusWidgetProps> = ({
  minutes = 0,
}) => {
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  const targetMinutes = 240;
  const progressPercent = Math.min(100, Math.round((minutes / targetMinutes) * 100));

  return (
    <Card className="flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm hover:border-primary/50 transition-all">
      {/* 头部：遵循 CardHeader 与 CardTitle 复合规范 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
            <Clock className="size-4.5" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            今日专注
          </CardTitle>
        </div>

        <Badge variant="default" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-mono">
          <Flame className="size-3 text-[#ff79c6]" />
          <span>{progressPercent}%</span>
        </Badge>
      </CardHeader>

      {/* 核心大指标值内容区 */}
      <CardContent className="p-0 my-auto py-1">
        <div className="flex items-baseline gap-1.5 font-mono">
          {hours > 0 ? (
            <>
              <span className="text-3xl font-extrabold tracking-tight text-foreground">{hours}</span>
              <span className="text-sm font-semibold text-muted-foreground mr-1.5">h</span>
              <span className="text-3xl font-extrabold tracking-tight text-foreground">{remainMins}</span>
              <span className="text-sm font-semibold text-muted-foreground">m</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-extrabold tracking-tight text-foreground">{remainMins}</span>
              <span className="text-sm font-semibold text-muted-foreground">分钟</span>
            </>
          )}
        </div>
      </CardContent>

      {/* 底部使用官方 Progress 组件与 CardFooter 规范 */}
      <CardFooter className="p-0 border-none mt-0 flex flex-col gap-2">
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between w-full text-xs font-mono text-muted-foreground">
          <span>投入 {(minutes / 60).toFixed(1)}h</span>
          <span>目标 4h</span>
        </div>
      </CardFooter>
    </Card>
  );
};
