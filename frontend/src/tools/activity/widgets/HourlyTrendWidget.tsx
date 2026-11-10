/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：24小时专注走势图，关闭 Recharts 循环补间动画与稳定缓存，消除空转 GPU 渲染开销
 **/

import React, { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { TrendingUp, Clock } from "lucide-react";

interface HourlyTrendWidgetProps {
  hourlyFocus?: number[]; // 24 个数值，代表每个小时的专注分钟数 (0~60)
}

const chartConfig = {
  minutes: {
    label: "专注",
    color: "rgb(var(--primary))",
  },
} satisfies ChartConfig;

export const HourlyTrendWidget: React.FC<HourlyTrendWidgetProps> = React.memo(({
  hourlyFocus = new Array(24).fill(0),
}) => {
  const currentHour = new Date().getHours();

  // 整理 24 小时数据流
  const rawData = hourlyFocus.length === 24 ? hourlyFocus : new Array(24).fill(0);
  const maxMinutes = Math.max(...rawData);
  const currentHourMins = rawData[currentHour] || 0;

  // 使用数值序列字符串作为 memo 依赖，确保只有数据数值真正变化时才重新构造图表数据数组
  const rawDataKey = rawData.join(",");

  const chartData = useMemo(() => {
    return rawData.map((minutes, hour) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      displayTime: `${String(hour).padStart(2, "0")}:00`,
      minutes,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDataKey]);

  return (
    <Card className="flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm hover:border-primary/50 transition-all select-none">
      {/* 头部：CardHeader 与 CardTitle 复合规范 */}
      <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
            <TrendingUp className="size-4.5" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            全天走势
          </CardTitle>
        </div>

        {/* 当前小时状态 Badge */}
        <Badge variant="outline" className="text-xs font-mono px-2.5 py-0.5 bg-secondary text-secondary-foreground border-border flex items-center gap-1.5">
          <Clock className="size-3 text-primary" />
          <span>{String(currentHour).padStart(2, "0")}:00</span>
          {currentHourMins > 0 && (
            <span className="font-bold text-primary">· {currentHourMins}m</span>
          )}
        </Badge>
      </CardHeader>

      {/* 图表主体内容区：shadcn/ui 官方 ChartContainer + AreaChart */}
      <CardContent className="p-0 my-auto pt-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="h-[84px] w-full aspect-auto"
        >
          <AreaChart
            data={chartData}
            margin={{ top: 6, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              {/* Cosmic Night 极光紫夜主色平滑渐变 */}
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="rgb(var(--primary))"
                  stopOpacity={0.55}
                />
                <stop
                  offset="95%"
                  stopColor="rgb(var(--primary))"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>

            {/* 背景横向参考虚线网格，解决大面积空白单薄感 */}
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-border/40"
            />

            {/* X 轴极简时间刻度 */}
            <XAxis
              dataKey="hourLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              ticks={["00:00", "06:00", "12:00", "18:00", "23:00"]}
              className="text-[10px] font-mono fill-muted-foreground"
            />

            {/* 隐藏 Y 轴但锁定 60 分钟域 */}
            <YAxis
              hide
              domain={[0, Math.max(60, maxMinutes)]}
            />

            {/* shadcn 官方 ChartTooltip 悬停反馈 */}
            <ChartTooltip
              cursor={{
                stroke: "rgb(var(--primary) / 0.4)",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelKey="displayTime"
                  formatter={(value) => (
                    <span className="font-mono font-medium text-foreground">
                      {value} <span className="text-muted-foreground text-[10px]">分钟</span>
                    </span>
                  )}
                />
              }
            />

            {/* 平滑渐变曲线：关闭 isAnimationActive 彻底消除 1500ms requestAnimationFrame 循环计算 */}
            <Area
              dataKey="minutes"
              type="monotone"
              fill="url(#trendGradient)"
              stroke="rgb(var(--primary))"
              strokeWidth={2}
              isAnimationActive={false}
              dot={false}
              activeDot={{
                r: 4,
                fill: "rgb(var(--primary))",
                stroke: "rgb(var(--card))",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>

      {/* 底部指标栏：CardFooter */}
      <CardFooter className="p-0 border-t border-border mt-0 pt-2 flex justify-between items-center text-xs font-mono text-muted-foreground">
        <span>峰值 {maxMinutes}m</span>
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="size-2 rounded-full bg-primary inline-block" />
          实时走势
        </span>
      </CardFooter>
    </Card>
  );
});
