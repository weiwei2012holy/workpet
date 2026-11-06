/**
 * @Author wei
 * @Date 2026-11-05
 * @Description 仪表盘指标小组件：今日休息，采用 shadcn/ui Card 完整复合结构重构
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
import { Coffee, HeartPulse } from "lucide-react";

interface TodayRestWidgetProps {
  restMinutes: number;
  restCount: number;
}

export const TodayRestWidget: React.FC<TodayRestWidgetProps> = ({
  restMinutes = 0,
  restCount = 0,
}) => {
  return (
    <Card className="flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm hover:border-state-away/50 transition-all">
      {/* 头部：CardHeader 与 CardTitle 复合规范 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-state-away/15 border border-state-away/25 flex items-center justify-center text-state-away">
            <Coffee className="size-4.5" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            今日休息
          </CardTitle>
        </div>

        <Badge variant="away" className="flex items-center gap-1 text-xs px-2.5 py-0.5 font-mono">
          <HeartPulse className="size-3 text-state-away" />
          <span>{restCount} 次</span>
        </Badge>
      </CardHeader>

      {/* 核心大指标值内容区 */}
      <CardContent className="p-0 my-auto py-1">
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-3xl font-extrabold tracking-tight text-state-away">
            {restMinutes}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">分钟</span>
        </div>
      </CardContent>

      {/* 底部指标精简栏：CardFooter 规范 */}
      <CardFooter className="p-0 border-t border-border mt-0 pt-2 flex justify-between items-center text-xs font-mono text-muted-foreground">
        <span>离座 {restCount} 次</span>
        <span>单次约 {restCount > 0 ? Math.round(restMinutes / restCount) : 0}m</span>
      </CardFooter>
    </Card>
  );
};
