/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 随行桌面极简消息通知弹窗，支持午休/下班长时间离座状态感知，采用 React Bits 的 SwipeToast 手势交互弹窗
 **/

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Events } from "@wailsio/runtime";
import { Play, Pause, RotateCcw, Check, Sparkles } from "lucide-react";
import SwipeToast, { SwipeToastCloseReason } from "@/components/SwipeToast";
import { Service as ActivityService } from "../../../bindings/workpet/pkg/tools/activity";
import { ReminderState } from "../../../bindings/workpet/pkg/tools/activity/models";

// 提示音效
const playAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(523.25, 0, 0.35);   // C5
    playTone(659.25, 0.12, 0.45); // E5
  } catch (e) {
    console.error("提醒音效播放失败:", e);
  }
};

const playWelcomeBackSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(523.25, 0, 0.15);   // C5
    playTone(783.99, 0.09, 0.18); // G5
    playTone(1046.5, 0.18, 0.28); // C6
  } catch (e) {
    console.error("归来音效播放失败:", e);
  }
};

export default function ActivityWidget() {
  const [state, setState] = useState<ReminderState>({
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

  // 控制 SwipeToast 的开启与关闭
  const [open, setOpen] = useState<boolean>(true);
  const hasAlertedRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // 记录鼠标按下位置，区分原生拖拽与单击打开看板
  const handleTimeMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleTimeClick = (e: React.MouseEvent) => {
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        return; // 用户刚才是在拖动窗口位置，拦截单击误触
      }
    }
    ActivityService.OpenDashboard();
  };

  // 唤起与数据刷新自愈
  const handleWakeup = useCallback(() => {
    ActivityService.GetState()
      .then((res) => {
        if (res) setState(res);
      })
      .catch(console.error);

    setOpen(true);
  }, []);

  // 当弹窗完成退场时调用原生隐藏
  const handleToastClose = (reason: SwipeToastCloseReason) => {
    setOpen(false);
    ActivityService.HideWindow();
  };

  // 1. 初始化数据与全生命周期事件监听
  useEffect(() => {
    handleWakeup();

    // 核心生命周期：后端通知窗口被 Show
    const unShown = Events.On("reminder:window-shown", () => {
      handleWakeup();
    });

    // 浏览器原生焦点与可见性生命周期
    const handleFocus = () => {
      handleWakeup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleWakeup();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 监听时钟跳动事件
    const unTick = Events.On("reminder:tick", (evt: any) => {
      const payload: ReminderState = evt.data || evt;
      if (!payload) return;
      setState(payload);

      if (payload.isReminding && !hasAlertedRef.current) {
        hasAlertedRef.current = true;
        setOpen(true);
        playAlertSound();
      } else if (!payload.isReminding) {
        hasAlertedRef.current = false;
      }
    });

    // 监听离座归位欢迎事件
    const unReturned = Events.On("reminder:returned", (evt: any) => {
      const payload: ReminderState = evt.data || evt;
      if (payload) {
        setState(payload);
        setOpen(true);
        playWelcomeBackSound();
      }
    });

    // 监听后端发起的自动淡出请求
    const unFadeOut = Events.On("reminder:request-fade-out", () => {
      setOpen(false);
    });

    // 全局快捷键调度
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        ActivityService.Quit();
        return;
      }
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && (e.key === "w" || e.key === "W"))) {
        e.preventDefault();
        setOpen(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (unShown) unShown();
      if (unTick) unTick();
      if (unReturned) unReturned();
      if (unFadeOut) unFadeOut();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleWakeup]);

  // 操作处理
  const handleAcknowledge = async () => {
    const updated = await ActivityService.AcknowledgeRest();
    setState(updated);
    setOpen(false);
  };

  const handleSnooze = async (minutes: number) => {
    const updated = await ActivityService.Snooze(minutes);
    setState(updated);
    setOpen(false);
  };

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await ActivityService.TogglePause();
    setState(updated);
  };

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await ActivityService.ResetTimer();
    setState(updated);
  };

  // 计算展示时间
  const displayMins = Math.floor(Math.max(0, state.remainingSeconds) / 60);
  const displaySecs = Math.max(0, state.remainingSeconds) % 60;
  const timeFormatted = `${String(displayMins).padStart(2, "0")}:${String(displaySecs).padStart(2, "0")}`;

  const totalTargetSecs = Math.max(1, state.intervalMinutes * 60);
  const progressPercent = Math.min(100, Math.max(0, (state.elapsedSeconds / totalTargetSecs) * 100));

  // 经典紫夜流光色彩（与老版本完全一致）
  const fuseColor = state.isReminding
    ? "#ff5470"
    : state.isAway
    ? "#64b5f6"
    : state.isPaused
    ? "#fbbf24"
    : "#c084fc";

  return (
    <div className="w-full h-full flex items-center justify-center p-0 m-0 select-none bg-transparent overflow-hidden">
      <SwipeToast
        open={open}
        onClose={handleToastClose}
        inline={true}
        width={356}
        radius={18}
        dismissible={false} /* 核心：关闭内部 DOM 下滑手势，彻底杜绝文字上下橡皮筋滚动，零冲突直通 macOS 原生拖拽 */
        slideMs={360}
        settleBounce={0.25}
        swipeDistance={38}
        duration={0} /* 窗口常驻，支持按键或失焦收起 */
        fuse="bottom"
        fuseColor={fuseColor}
        color="#ffffff"
        pauseOnHover={true}
        closeButton={false}
        className={state.isReminding ? "is-alerting" : ""}
      >
        {/* 自定义卡片内容：整卡原生可拖拽，按钮专属防拖拽 */}
        <div
          style={{ "--wails-draggable": "drag" } as React.CSSProperties}
          className="flex items-center justify-between w-full h-full gap-2.5 py-0.5 cursor-grab active:cursor-grabbing"
          title="按住任意区域拖动悬浮窗位置"
        >
          {/* 1. 左侧状态微感知图标 */}
          <div className="flex items-center pl-0.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all shadow-sm ${
                state.isReminding
                  ? "bg-rose-500/25 text-rose-400 border border-rose-500/50 animate-pulse"
                  : state.isOffDuty
                  ? "bg-purple-500/25 text-purple-300 border border-purple-500/40"
                  : state.isAway
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/35"
                  : state.isPaused
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/35"
                  : "bg-[#c084fc]/15 text-[#fdf4ff] border border-[#c084fc]/30"
              }`}
            >
              {state.isReminding
                ? "🚨"
                : state.isOffDuty
                ? "🌙"
                : state.isAway
                ? "😴"
                : state.isPaused
                ? "☕"
                : "🪐"}
            </div>
          </div>

          {/* 2. 核心大字时间与状态指示（轻点打开大控制看板，按住则原生拖拽窗口） */}
          <div
            onMouseDown={handleTimeMouseDown}
            onClick={handleTimeClick}
            className="flex-1 flex flex-col justify-center px-2 group/timer"
            title="点击打开指标看板与控制台（拖动可调整窗口位置）"
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`font-mono text-[29px] font-bold tracking-tight leading-none transition-colors ${
                  state.isReminding
                    ? "text-rose-400"
                    : state.isOffDuty
                    ? "text-purple-300"
                    : state.isAway
                    ? "text-sky-400"
                    : state.isPaused
                    ? "text-amber-400"
                    : "text-white group-hover/timer:text-[#c084fc]"
                }`}
              >
                {state.isReminding ? "00:00" : timeFormatted}
              </span>
              {state.isPaused && (
                <span className="text-[11px] font-medium text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                  暂停
                </span>
              )}
              {state.isAway && !state.isOffDuty && (
                <span className="text-[11px] font-medium text-sky-300 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 flex items-center gap-0.5">
                  <Sparkles size={11} /> 离座
                </span>
              )}
              {state.isOffDuty && (
                <span className="text-[11px] font-medium text-purple-300 px-1.5 py-0.5 rounded bg-purple-500/25 border border-purple-500/40 flex items-center gap-0.5">
                  🌙 午休/下班
                </span>
              )}
            </div>

            {/* 极简经典极光紫流光细进度条 */}
            <div className="w-full h-[2.5px] bg-white/15 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  state.isReminding
                    ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                    : state.isOffDuty
                    ? "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                    : state.isAway
                    ? "bg-sky-400"
                    : state.isPaused
                    ? "bg-amber-400"
                    : "bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#e879f9]"
                }`}
                style={{
                  width: `${state.isReminding || state.isOffDuty ? 100 : progressPercent}%`,
                }}
              />
            </div>
          </div>

          {/* 3. 右侧快捷操作区 */}
          <div
            style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}
            className="flex items-center gap-1.5 shrink-0"
          >
            {state.isReminding ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  className="h-8 px-3 rounded-lg bg-[#4db6ac] hover:bg-[#39a096] text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-transform active:scale-95"
                  title="已起身活动，重新开启计时"
                >
                  <Check size={13} strokeWidth={3} />
                  <span>已休息</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSnooze(5)}
                  className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#fdf4ff] text-xs font-medium border border-white/15 transition-transform active:scale-95"
                  title="稍后 5 分钟提醒"
                >
                  +5m
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {/* 暂停 / 继续按钮 */}
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                    state.isPaused
                      ? "bg-amber-500/25 text-amber-300 hover:bg-amber-500/35"
                      : "text-[#d8b4fe] hover:text-white hover:bg-white/10"
                  }`}
                  title={state.isPaused ? "继续计时" : "暂停计时"}
                >
                  {state.isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
                </button>

                {/* 重置当前周期按钮 */}
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-7 w-7 rounded-lg text-[#d8b4fe] hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors active:scale-95"
                  title="重置当前周期"
                >
                  <RotateCcw size={13} />
                </button>

                {/* 向下滑动收起提示与快捷关闭 */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded-lg text-[#d8b4fe]/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors active:scale-95 ml-0.5"
                  title="收起弹窗 (可按 Esc 或直接向下拖拽划走)"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </SwipeToast>
    </div>
  );
}
