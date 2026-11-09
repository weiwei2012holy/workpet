/**
 * @Author wei
 * @Date 2026-11-09
 * @Description 今日活动与专注数据报表弹窗（ActivityDataModal），支持在不将组件添加到指标看板的前提下，独立查看今日专注投入、休息频次、实时感知状态与24小时走势
 **/

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Clock,
  Coffee,
  Activity,
  Flame,
  TrendingUp,
  HeartPulse,
  Moon,
  Settings,
  Calendar,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import * as ActivityService from "@/../bindings/workpet/pkg/tools/activity/service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { APP_EVENTS, subscribeEvent, ActivityStatsPayload, ReminderTickPayload } from "@/types/events";

interface ActivityDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  initialStats?: any;
  initialReminderState?: any;
}

const chartConfig = {
  minutes: {
    label: "专注",
    color: "rgb(var(--primary))",
  },
} satisfies ChartConfig;

export const ActivityDataModal: React.FC<ActivityDataModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  initialStats,
  initialReminderState,
}) => {
  const [stats, setStats] = useState<any>(initialStats || {
    todayFocusMinutes: 0,
    todayRestMinutes: 0,
    restCount: 0,
    currentState: "working",
    hourlyFocus: new Array(24).fill(0),
    todayDate: "",
  });

  const [reminderState, setReminderState] = useState<any>(initialReminderState || {
    intervalMinutes: 30,
    elapsedSeconds: 0,
    remainingSeconds: 1800,
    isPaused: false,
    isReminding: false,
    restCount: 0,
    isAway: false,
    isOffDuty: false,
    idleThresholdMinutes: 3,
    offDutyThresholdMinutes: 30,
    currentIdleSeconds: 0,
  });

  // 当弹窗打开时，主动同步最新快照，并开启实时事件监听
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const s = await ActivityService.GetStats();
        if (s) setStats(s);
        const r = await ActivityService.GetState();
        if (r) setReminderState(r);
      } catch (err) {
        console.error("加载今日活动数据快照失败:", err);
      }
    };

    fetchData();

    const unbindStats = subscribeEvent<ActivityStatsPayload>(
      APP_EVENTS.ACTIVITY_STATS_UPDATE,
      (data) => setStats(data)
    );

    const unbindTick = subscribeEvent<ReminderTickPayload>(
      APP_EVENTS.REMINDER_TICK,
      (data) => setReminderState(data)
    );

    return () => {
      if (unbindStats) unbindStats();
      if (unbindTick) unbindTick();
    };
  }, [isOpen]);

  // 计算今日专注核心指标
  const focusMinutes = stats.todayFocusMinutes || 0;
  const focusHours = Math.floor(focusMinutes / 60);
  const focusRemainMins = focusMinutes % 60;
  const targetFocusMinutes = 240; // 目标 4 小时
  const focusProgress = Math.min(100, Math.round((focusMinutes / targetFocusMinutes) * 100));

  // 休息与感知指标
  const restMinutes = stats.todayRestMinutes || 0;
  const restCount = stats.restCount || reminderState.restCount || 0;
  const avgRestMinutes = restCount > 0 ? Math.round(restMinutes / restCount) : 0;

  // 当前实时感知状态
  const currentState = reminderState.isOffDuty
    ? "offduty"
    : reminderState.isAway
    ? "away"
    : reminderState.isReminding
    ? "reminding"
    : reminderState.isPaused
    ? "paused"
    : "working";

  const getStatusMeta = () => {
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
          title: "提醒休息中",
          dotColor: "bg-state-alerting",
          badgeVariant: "destructive" as const,
          iconColor: "text-state-alerting",
          bgIcon: "bg-state-alerting/15 border-state-alerting/25",
        };
      case "away":
        return {
          title: "暂时离座中",
          dotColor: "bg-state-away",
          badgeVariant: "away" as const,
          iconColor: "text-state-away",
          bgIcon: "bg-state-away/15 border-state-away/25",
        };
      case "paused":
        return {
          title: "时钟已暂停",
          dotColor: "bg-state-paused",
          badgeVariant: "secondary" as const,
          iconColor: "text-state-paused",
          bgIcon: "bg-state-paused/15 border-state-paused/25",
        };
      default:
        return {
          title: "专注工作中",
          dotColor: "bg-state-ready",
          badgeVariant: "success" as const,
          iconColor: "text-state-ready",
          bgIcon: "bg-state-ready/15 border-state-ready/25",
        };
    }
  };

  const statusMeta = getStatusMeta();

  // 离座静止倒计时比例
  const currentIdleSec = reminderState.currentIdleSeconds || 0;
  const idleThresholdSec = (reminderState.idleThresholdMinutes || 3) * 60;
  const idleRatio = Math.min(100, Math.round((currentIdleSec / idleThresholdSec) * 100));

  // 整理 24 小时专注走势图数据
  const hourlyFocusRaw = stats.hourlyFocus && stats.hourlyFocus.length === 24
    ? stats.hourlyFocus
    : new Array(24).fill(0);
  const currentHour = new Date().getHours();
  const currentHourMins = hourlyFocusRaw[currentHour] || 0;
  const peakMins = Math.max(...hourlyFocusRaw);

  const chartData = useMemo(() => {
    return hourlyFocusRaw.map((minutes: number, hour: number) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      displayTime: `${String(hour).padStart(2, "0")}:00`,
      minutes,
    }));
  }, [hourlyFocusRaw]);

  // 今日日期格式化
  const displayDate = stats.todayDate || new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-6 bg-card border-border shadow-2xl overflow-hidden flex flex-col gap-6">
        {/* 弹窗头部：遵循规范包含 DialogTitle 与 DialogDescription */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                <BarChart3 className="size-4.5" />
              </div>
              <span>今日活动与专注数据</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              实时物理键鼠感知，无需加入看板即可在此随时全面追踪今日专注、作息与时段走势
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono px-2.5 py-0.5 border-border bg-muted/40 text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3 text-primary" />
              <span>{displayDate}</span>
            </Badge>
            <Badge variant={statusMeta.badgeVariant} className="text-xs px-2.5 py-0.5 flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${statusMeta.dotColor} animate-pulse`} />
              <span>{statusMeta.title}</span>
            </Badge>
          </div>
        </DialogHeader>

        {/* 核心指标卡片 3 栏网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 指标卡 1：今日专注 */}
          <Card className="p-4 bg-muted/20 border-border flex flex-col justify-between gap-3 shadow-none">
            <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                  <Clock className="size-3.5" />
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  今日累计专注
                </CardTitle>
              </div>
              <Badge variant="default" className="text-[11px] px-2 py-0 font-mono bg-primary/20 text-primary border border-primary/30">
                <Flame className="size-2.5 mr-0.5" />
                {focusProgress}%
              </Badge>
            </CardHeader>

            <CardContent className="p-0 my-auto py-1">
              <div className="flex items-baseline gap-1.5 font-mono">
                {focusHours > 0 ? (
                  <>
                    <span className="text-2xl font-black text-foreground">{focusHours}</span>
                    <span className="text-xs font-medium text-muted-foreground mr-1">小时</span>
                    <span className="text-2xl font-black text-foreground">{focusRemainMins}</span>
                    <span className="text-xs font-medium text-muted-foreground">分钟</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-foreground">{focusRemainMins}</span>
                    <span className="text-xs font-medium text-muted-foreground">分钟</span>
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter className="p-0 flex flex-col gap-1.5 border-none mt-0">
              <Progress value={focusProgress} className="h-1.5" />
              <div className="flex justify-between w-full text-[11px] font-mono text-muted-foreground">
                <span>投入 {(focusMinutes / 60).toFixed(1)}h</span>
                <span>目标 4.0h</span>
              </div>
            </CardFooter>
          </Card>

          {/* 指标卡 2：今日休息 */}
          <Card className="p-4 bg-muted/20 border-border flex flex-col justify-between gap-3 shadow-none">
            <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-md bg-state-away/15 border border-state-away/25 flex items-center justify-center text-state-away">
                  <Coffee className="size-3.5" />
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  离座与作息
                </CardTitle>
              </div>
              <Badge variant="away" className="text-[11px] px-2 py-0 font-mono">
                <HeartPulse className="size-2.5 mr-0.5 text-state-away" />
                {restCount} 次达标
              </Badge>
            </CardHeader>

            <CardContent className="p-0 my-auto py-1">
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-2xl font-black text-state-away">{restMinutes}</span>
                <span className="text-xs font-medium text-muted-foreground">分钟</span>
              </div>
            </CardContent>

            <CardFooter className="p-0 border-t border-border/60 pt-2 flex justify-between items-center text-[11px] font-mono text-muted-foreground">
              <span>共离座 {restCount} 次</span>
              <span>单次约 {avgRestMinutes}m</span>
            </CardFooter>
          </Card>

          {/* 指标卡 3：当前感知状态 */}
          <Card className="p-4 bg-muted/20 border-border flex flex-col justify-between gap-3 shadow-none">
            <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <div className={`size-7 rounded-md border flex items-center justify-center ${statusMeta.bgIcon} ${statusMeta.iconColor}`}>
                  {currentState === "offduty" ? <Moon className="size-3.5" /> : <Activity className="size-3.5" />}
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">
                  当前实时感知
                </CardTitle>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                每秒检测
              </span>
            </CardHeader>

            <CardContent className="p-0 my-auto py-1">
              <div className="flex items-center justify-between font-mono">
                <span className="text-sm font-semibold text-foreground">{statusMeta.title}</span>
                <span className="text-xs text-muted-foreground">
                  {currentState === "working" ? `静止 ${currentIdleSec}s` : "已感知离席"}
                </span>
              </div>
            </CardContent>

            <CardFooter className="p-0 flex flex-col gap-1.5 border-none mt-0">
              <Progress value={idleRatio} className="h-1.5" />
              <div className="flex justify-between w-full text-[11px] font-mono text-muted-foreground">
                <span>离座判定阈值</span>
                <span>{reminderState.idleThresholdMinutes || 3} 分钟</span>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* 24 小时全天走势宽屏大图表 */}
        <Card className="p-4 bg-muted/20 border-border flex flex-col gap-3 shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                <TrendingUp className="size-3.5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                24 小时全天专注时段走势
              </h4>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span>峰值时段: <b className="text-foreground">{peakMins}m</b></span>
              <span>·</span>
              <span>当前小时: <b className="text-primary">{currentHourMins}m</b></span>
            </div>
          </div>

          <div className="pt-2">
            <ChartContainer config={chartConfig} className="h-[120px] w-full aspect-auto">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="modalTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="rgb(var(--primary))" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(var(--foreground), 0.08)"
                />
                <XAxis
                  dataKey="hour"
                  stroke="rgba(var(--muted-foreground), 0.6)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                  tickFormatter={(val) => `${val}:00`}
                />
                <YAxis
                  stroke="rgba(var(--muted-foreground), 0.6)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 60]}
                  ticks={[0, 30, 60]}
                  width={24}
                  tickFormatter={(val) => `${val}m`}
                />
                <ChartTooltip
                  cursor={{ stroke: "rgb(var(--primary))", strokeWidth: 1, strokeDasharray: "2 2" }}
                  content={
                    <ChartTooltipContent
                      labelKey="hourLabel"
                      formatter={(val) => (
                        <span className="font-mono font-bold text-primary">
                          {val} 分钟
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="rgb(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#modalTrendGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>

        {/* 弹窗底部操作 */}
        <DialogFooter className="flex flex-row items-center justify-between pt-2 border-t border-border">
          {onOpenSettings ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border"
            >
              <Settings className="size-3.5" />
              <span>调整专注与提醒参数</span>
            </Button>
          ) : (
            <div />
          )}

          <Button
            size="sm"
            onClick={onClose}
            className="px-5 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
          >
            完成查看
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
