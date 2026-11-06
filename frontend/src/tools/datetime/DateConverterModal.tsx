/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 全功能日期与时间戳转换器工作台弹窗（极简纯粹，彻底移除冗余说明文案，聚焦核心数据与快速复制）
 **/

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Clock,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Calendar,
  Globe,
  Database,
  ClipboardPaste,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseAnyDateInput,
  convertDateToAllFormats,
  getTodayStart,
  getTodayEnd,
  addDays,
  addHours,
  formatLocalStandard,
  ConvertedDateFormats,
} from "./utils";

interface DateConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: string | number;
}

export const DateConverterModal: React.FC<DateConverterModalProps> = ({
  isOpen,
  onClose,
  initialValue,
}) => {
  // 当前输入的原始文本
  const [inputValue, setInputValue] = useState<string>("");
  // 当前基准 Date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  // 最近一次识别的输入类型
  const [detectedType, setDetectedType] = useState<string>("此刻");
  // 复制反馈状态（记录被复制项的 key）
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 记录上一次的弹窗打开状态，仅在“从关闭变为打开”时初始化一次，避免被外部每秒 tick 冲刷
  const prevOpenRef = useRef<boolean>(false);

  // 仅在弹窗打开的一瞬间进行初始化；打开期间状态由用户操作完全锁定
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if (initialValue !== undefined && initialValue !== null && initialValue !== "") {
        setInputValue(String(initialValue));
        const res = parseAnyDateInput(initialValue);
        if (res) {
          setCurrentDate(res.date);
          setDetectedType(res.detectedType);
        }
      } else {
        const now = new Date();
        setCurrentDate(now);
        setInputValue(formatLocalStandard(now));
        setDetectedType("此刻");
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // 处理输入变化实时双向同步
  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (!val.trim()) {
      const now = new Date();
      setCurrentDate(now);
      setDetectedType("当前时间");
      return;
    }
    const res = parseAnyDateInput(val);
    if (res) {
      setCurrentDate(res.date);
      setDetectedType(res.detectedType);
    } else {
      setDetectedType("格式未知");
    }
  };

  // 生成所有格式
  const formats: ConvertedDateFormats = useMemo(() => {
    return convertDateToAllFormats(currentDate, detectedType);
  }, [currentDate, detectedType]);

  // 一键复制并给出反馈
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  // 快捷操作：此时此刻（统一填充为直观的标准日期格式 YYYY-MM-DD HH:mm:ss）
  const handleSetNow = () => {
    const now = new Date();
    setCurrentDate(now);
    setInputValue(formatLocalStandard(now));
    setDetectedType("此刻");
  };

  // 快捷操作：今天 00:00:00 (固定锁定目标时刻)
  const handleSetTodayStart = () => {
    const d = getTodayStart(currentDate);
    setCurrentDate(d);
    setInputValue(formatLocalStandard(d));
    setDetectedType("今日零点");
  };

  // 快捷操作：今天 23:59:59 (固定锁定目标时刻)
  const handleSetTodayEnd = () => {
    const d = getTodayEnd(currentDate);
    setCurrentDate(d);
    setInputValue(formatLocalStandard(d));
    setDetectedType("今日结束");
  };

  // 步进调节
  const handleStepDay = (days: number) => {
    const d = addDays(currentDate, days);
    setCurrentDate(d);
    setInputValue(formatLocalStandard(d));
  };

  const handleStepHour = (hours: number) => {
    const d = addHours(currentDate, hours);
    setCurrentDate(d);
    setInputValue(formatLocalStandard(d));
  };

  // 粘贴剪贴板
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleInputChange(text.trim());
      }
    } catch (e) {
      console.warn("读取剪贴板受限:", e);
    }
  };

  // 纯粹、无废话的格式条目定义
  const formatRows = [
    {
      key: "unixSeconds",
      name: "时间戳 (秒)",
      value: formats.unixSeconds,
      icon: <Database className="size-4 text-primary" />,
    },
    {
      key: "unixMillis",
      name: "时间戳 (毫秒)",
      value: formats.unixMillis,
      icon: <Database className="size-4 text-state-working" />,
    },
    {
      key: "localStandard",
      name: "本地时间",
      value: formats.localStandard,
      icon: <Clock className="size-4 text-primary" />,
    },
    {
      key: "sqlFormat",
      name: "本地时间 (含毫秒)",
      value: formats.sqlFormat,
      icon: <Calendar className="size-4 text-state-ready" />,
    },
    {
      key: "isoLocal",
      name: "ISO 8601",
      value: formats.isoLocal,
      icon: <Globe className="size-4 text-state-away" />,
    },
    {
      key: "isoUtc",
      name: "UTC (零时区)",
      value: formats.isoUtc,
      icon: <Globe className="size-4 text-muted-foreground" />,
    },
    {
      key: "relative",
      name: "相对时间",
      value: formats.relative,
      icon: <Sparkles className="size-4 text-state-paused" />,
    },
    {
      key: "rfc7231",
      name: "RFC 7231 (HTTP)",
      value: formats.rfc7231,
      icon: <Globe className="size-4 text-muted-foreground" />,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl text-foreground">
        {/* 头部标题区：纯净极简（右侧预留 pr-12 避免与自带关闭按钮重叠） */}
        <DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/20 text-left shrink-0 pr-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                <Clock className="size-4" />
              </div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  时间转换器
                </DialogTitle>
                <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                  {formats.timezoneOffset}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 主体交互区 */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* 1. 快捷动作按钮栏 */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetNow}
                className="h-7 px-2.5 text-xs flex items-center gap-1 font-semibold border-border hover:bg-card"
              >
                <RotateCcw className="size-3 text-primary" />
                此刻
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetTodayStart}
                className="h-7 px-2.5 text-xs flex items-center gap-1 border-border hover:bg-card"
              >
                今日零点
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetTodayEnd}
                className="h-7 px-2.5 text-xs flex items-center gap-1 border-border hover:bg-card"
              >
                今日结束
              </Button>
            </div>

            {/* 步进微调按钮 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStepHour(-1)}
                className="h-7 px-1.5 text-xs"
                title="减 1 小时"
              >
                -1h
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStepHour(1)}
                className="h-7 px-1.5 text-xs"
                title="加 1 小时"
              >
                +1h
              </Button>
              <div className="w-[1px] h-3 bg-border mx-0.5" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStepDay(-1)}
                className="h-7 px-1.5 text-xs"
                title="减 1 天"
              >
                -1d
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStepDay(1)}
                className="h-7 px-1.5 text-xs"
                title="加 1 天"
              >
                +1d
              </Button>
            </div>
          </div>

          {/* 2. 输入框 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text) {
                    e.preventDefault();
                    handleInputChange(text.trim());
                  }
                }}
                placeholder="粘贴时间戳或日期..."
                className="font-mono text-sm h-9 bg-background/50 border-border focus-visible:border-primary pr-7"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => handleInputChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteClipboard}
              className="h-9 px-2.5 flex items-center gap-1 text-xs shrink-0 border-border"
              title="粘贴剪贴板内容"
            >
              <ClipboardPaste className="size-3.5" />
              <span>粘贴</span>
            </Button>
          </div>

          {/* 3. 极简格式转换结果列表（单行高效排版，去除所有说明文字） */}
          <div className="flex flex-col gap-1.5">
            {formatRows.map((row) => {
              const isCopied = copiedKey === row.key;

              return (
                <div
                  key={row.key}
                  onClick={() => handleCopy(row.value, row.key)}
                  className="h-10 px-3 rounded-lg border border-border bg-card/60 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                  title="点击整行一键复制"
                >
                  {/* 左侧：图标与纯净名称（单行排布，无多余徽章和描述） */}
                  <div className="flex items-center gap-2 min-w-[130px] sm:min-w-[150px] shrink-0">
                    {row.icon}
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {row.name}
                    </span>
                  </div>

                  {/* 中间：转换值（等宽大字体，清晰直观） */}
                  <div className="flex-1 font-mono text-xs sm:text-sm font-bold text-foreground select-all truncate text-left">
                    {row.value}
                  </div>

                  {/* 右侧：纯图标极简复制按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(row.value, row.key);
                    }}
                    className={`size-7 rounded-md shrink-0 transition-colors ${
                      isCopied
                        ? "text-emerald-500 bg-emerald-500/10"
                        : "text-muted-foreground hover:text-foreground group-hover:text-primary"
                    }`}
                    title="复制"
                  >
                    {isCopied ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
