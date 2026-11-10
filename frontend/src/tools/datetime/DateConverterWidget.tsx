/**
 * @Author wei
 * @Date 2026-11-10
 * @Description 仪表盘指标小组件：时间转换（视口感知休眠与静止指示灯，切后台零开销）
 **/

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Copy, Check, ExternalLink, RotateCcw } from "lucide-react";
import { parseAnyDateInput, formatLocalStandard, getTimezoneOffsetStr } from "./utils";
import { DateConverterModal } from "./DateConverterModal";

export const DateConverterWidget: React.FC = () => {
  // 当前物理实时系统时间（每秒步进）
  const [realtimeDate, setRealtimeDate] = useState<Date>(new Date());
  // 用户自定义转换目标时间（为 null 时跟随系统实时时钟）
  const [customDate, setCustomDate] = useState<Date | null>(null);

  // 就地编辑模式："timestamp" | "date" | null
  const [editingField, setEditingField] = useState<"timestamp" | "date" | null>(null);
  // 编辑中的临时输入文本
  const [editValue, setEditValue] = useState<string>("");

  // 独立的复制成功提示
  const [copiedTimestamp, setCopiedTimestamp] = useState<boolean>(false);
  const [copiedDate, setCopiedDate] = useState<boolean>(false);

  // 全功能转换工作台弹窗
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // 视口感知定时器：仅在页面处于前台可见时按秒跳动，切后台彻底休眠避免闲置空转
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (!timer && document.visibilityState === "visible") {
        setRealtimeDate(new Date());
        timer = setInterval(() => {
          setRealtimeDate(new Date());
        }, 1000);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        startTimer();
      } else {
        stopTimer();
      }
    };

    startTimer();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", startTimer);
    window.addEventListener("blur", stopTimer);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", startTimer);
      window.removeEventListener("blur", stopTimer);
    };
  }, []);

  // 当前所呈现的目标时刻（优先展示转换后的时刻，无转换时跟随实时时钟）
  const activeDate = customDate ?? realtimeDate;
  const currentTimestampSec = String(Math.floor(activeDate.getTime() / 1000));
  const currentDateFormatted = formatLocalStandard(activeDate);

  // 复制辅助函数
  const handleCopy = (e: React.MouseEvent, text: string, type: "timestamp" | "date") => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "timestamp") {
      setCopiedTimestamp(true);
      setTimeout(() => setCopiedTimestamp(false), 1800);
    } else {
      setCopiedDate(true);
      setTimeout(() => setCopiedDate(false), 1800);
    }
  };

  // 激活就地编辑（点击时间戳或日期）
  const startEditing = (field: "timestamp" | "date") => {
    setEditingField(field);
    setEditValue(field === "timestamp" ? currentTimestampSec : currentDateFormatted);
  };

  // 编辑时间戳：双向联动下方的格式化日期
  const handleTimestampChange = (val: string) => {
    setEditValue(val);
    if (!val.trim()) {
      return;
    }
    const res = parseAnyDateInput(val.trim());
    if (res) {
      setCustomDate(res.date);
    }
  };

  // 编辑格式化日期：双向联动上方的时间戳
  const handleDateChange = (val: string) => {
    setEditValue(val);
    if (!val.trim()) {
      return;
    }
    const res = parseAnyDateInput(val.trim());
    if (res) {
      setCustomDate(res.date);
    }
  };

  // 退出编辑处理
  const finishEditing = () => {
    setEditingField(null);
  };

  // 恢复跟随实时系统时钟
  const handleResetToRealtime = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCustomDate(null);
    setEditingField(null);
    setRealtimeDate(new Date());
  };

  return (
    <>
      <Card className="flex flex-col justify-between h-[180px] p-5 border-border bg-card shadow-sm hover:border-primary/50 transition-all select-none">
        {/* 头部：标题与工具栏 */}
        <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <Clock className="size-4.5" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              时间转换
            </CardTitle>
          </div>

          <div className="flex items-center gap-1">
            {/* 当处于自定义转换模式时，右上角浮现一键恢复实时时钟按钮 */}
            {customDate !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToRealtime}
                className="h-7 px-2 text-xs text-primary hover:bg-primary/10 flex items-center gap-1 font-medium rounded-lg"
                title="恢复当前实时时间"
              >
                <RotateCcw className="size-3" />
                <span>实时</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(true)}
              className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
              title="打开全功能工作台"
            >
              <ExternalLink className="size-3.5" />
              <span className="sr-only">打开工作台</span>
            </Button>
          </div>
        </CardHeader>

        {/* 核心内容区：直接展示时间戳与日期，两者都带独立复制，点击任意项就地转为输入框 */}
        <CardContent className="p-0 my-auto py-1 flex flex-col justify-center gap-2">
          {/* 1. 时间戳数据行 */}
          <div className="flex items-center justify-between gap-2 group/ts h-9">
            {editingField === "timestamp" ? (
              <Input
                value={editValue}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleTimestampChange(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text) {
                    e.preventDefault();
                    handleTimestampChange(text);
                  }
                }}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    finishEditing();
                  }
                }}
                placeholder="粘贴时间戳(秒/毫秒)..."
                className="font-mono text-2xl font-bold h-9 px-2 bg-muted/60 border-primary focus-visible:ring-1 focus-visible:ring-primary rounded-lg flex-1"
              />
            ) : (
              <div
                onClick={() => startEditing("timestamp")}
                className="font-mono text-[26px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors cursor-text truncate flex-1 leading-none select-all py-1"
                title="点击直接输入或粘贴时间戳"
              >
                {currentTimestampSec}
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleCopy(e, currentTimestampSec, "timestamp")}
              className="size-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              title="复制时间戳"
            >
              {copiedTimestamp ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5 group-hover/ts:text-primary" />
              )}
            </Button>
          </div>

          {/* 2. 格式化日期数据行 */}
          <div className="flex items-center justify-between gap-2 group/dt h-8">
            {editingField === "date" ? (
              <Input
                value={editValue}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleDateChange(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text) {
                    e.preventDefault();
                    handleDateChange(text);
                  }
                }}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    finishEditing();
                  }
                }}
                placeholder="例如: 2026-11-06 12:00:00"
                className="font-mono text-xs sm:text-sm font-semibold h-8 px-2 bg-muted/60 border-primary focus-visible:ring-1 focus-visible:ring-primary rounded-lg flex-1"
              />
            ) : (
              <div
                onClick={() => startEditing("date")}
                className="font-mono text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-text truncate flex-1 select-all py-1"
                title="点击直接输入或粘贴日期"
              >
                {currentDateFormatted}
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleCopy(e, currentDateFormatted, "date")}
              className="size-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              title="复制格式化日期"
            >
              {copiedDate ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5 group-hover/dt:text-primary" />
              )}
            </Button>
          </div>
        </CardContent>

        {/* 底部信息：状态指示灯与时区（极简化，杜绝冗余文字） */}
        <CardFooter className="p-0 border-t border-border mt-0 pt-2 flex justify-between items-center text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full inline-block ${
                customDate !== null
                  ? "bg-primary"
                  : "bg-emerald-500"
              }`}
            />
            <span>{customDate !== null ? "自定义" : "实时"}</span>
          </div>

          <span>{getTimezoneOffsetStr(activeDate)}</span>
        </CardFooter>
      </Card>

      {/* 完整全功能转换工作台弹窗 */}
      <DateConverterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialValue={currentTimestampSec}
      />
    </>
  );
};
