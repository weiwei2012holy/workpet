/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 活动追踪个性化配置弹窗（ActivitySettingsModal），增加午休/下班长时间离座判定阈值配置，采用 shadcn/ui 官方 Dialog 复合组件重构
 **/

import React, { useState } from "react";
import { Check, Clock, UserCheck, Moon } from "lucide-react";
import * as ActivityService from "@/../bindings/workpet/pkg/tools/activity/service";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ActivitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInterval: number;
  currentIdleThreshold: number;
  currentOffDutyThreshold?: number;
  onSaved: (interval: number, idleThreshold: number, offDutyThreshold: number) => void;
}

export const ActivitySettingsModal: React.FC<ActivitySettingsModalProps> = ({
  isOpen,
  onClose,
  currentInterval,
  currentIdleThreshold,
  currentOffDutyThreshold = 30,
  onSaved,
}) => {
  const [interval, setIntervalVal] = useState<number>(currentInterval || 30);
  const [idleThreshold, setIdleThresholdVal] = useState<number>(currentIdleThreshold || 3);
  const [offDutyThreshold, setOffDutyThresholdVal] = useState<number>(currentOffDutyThreshold || 30);
  const [customInterval, setCustomInterval] = useState<string>("");
  const [customOffDuty, setCustomOffDuty] = useState<string>("");

  const presetIntervals = [15, 30, 45, 60];
  const presetIdles = [1, 2, 3, 5];
  const presetOffDuties = [15, 30, 45, 60];

  const handleSave = async () => {
    let finalInterval = interval;
    if (customInterval.trim()) {
      const parsed = parseInt(customInterval, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 180) {
        finalInterval = parsed;
      }
    }

    let finalOffDuty = offDutyThreshold;
    if (customOffDuty.trim()) {
      const parsed = parseInt(customOffDuty, 10);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 240) {
        finalOffDuty = parsed;
      }
    }

    await ActivityService.SetInterval(finalInterval);
    await ActivityService.SetIdleThreshold(idleThreshold);
    await ActivityService.SetOffDutyThreshold(finalOffDuty);
    onSaved(finalInterval, idleThreshold, finalOffDuty);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-6 bg-card border-border shadow-2xl text-foreground">
        {/* 头部标题与描述 */}
        <DialogHeader className="text-left flex flex-row items-center gap-3 space-y-0">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-xl shadow-inner shrink-0">
            🧘
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              活动与专注 · 插件设置
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              定制您的身体休息提醒频率、离座感知及午休/下班时间过滤
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* 设置内容列表 */}
        <div className="flex flex-col gap-5 py-2">
          {/* 1. 专注提醒间隔 */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock className="size-4 text-primary" />
              每隔多久提醒休息一次（分钟）
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetIntervals.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setIntervalVal(mins);
                    setCustomInterval("");
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    interval === mins && !customInterval
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {mins} 分钟
                </button>
              ))}
            </div>
            {/* 自定义分钟 */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">自定义时长:</span>
              <input
                type="number"
                placeholder="1 ~ 180"
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-md bg-muted border border-border text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary"
              />
              <span className="text-xs text-muted-foreground">分钟</span>
            </div>
          </div>

          {/* 2. 离座空闲检测阈值 */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <UserCheck className="size-4 text-[#64b5f6]" />
              连续无操作判定为离开工位短休（分钟）
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetIdles.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setIdleThresholdVal(mins)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    idleThreshold === mins
                      ? "bg-[#64b5f6] text-[#0f0f1a] font-bold border-[#64b5f6] shadow-sm"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {mins} 分钟
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              离开电脑达到设定时间，系统会自动识别为接水、拉伸或离座休息，暂停专注计时。
            </p>
          </div>

          {/* 3. 午休 / 下班长时间离座排除阈值 */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Moon className="size-4 text-[#a855f7]" />
              长时间离座判定为午休或下班（分钟）
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetOffDuties.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setOffDutyThresholdVal(mins);
                    setCustomOffDuty("");
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                    offDutyThreshold === mins && !customOffDuty
                      ? "bg-[#a855f7] text-white font-bold border-[#a855f7] shadow-sm"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {mins} 分钟
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">自定义时长:</span>
              <input
                type="number"
                placeholder="5 ~ 240"
                value={customOffDuty}
                onChange={(e) => setCustomOffDuty(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-md bg-muted border border-border text-xs text-foreground placeholder-muted-foreground outline-none focus:border-[#a855f7]"
              />
              <span className="text-xs text-muted-foreground">分钟</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              连续离开超过该时间将自动判定为午休或下班离岗，该时间段不会计入日常休息与打卡统计。
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <DialogFooter className="flex justify-end gap-2.5 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} className="flex items-center gap-1.5 px-4">
            <Check className="size-4" />
            保存生效
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
