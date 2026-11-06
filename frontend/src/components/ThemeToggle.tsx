/**
 * @Author wei
 * @Date 2026-11-04
 * @Description 右上角外观模式切换按钮（支持黑夜、白天与跟随系统自动适配）
 **/

import React, { useState, useEffect } from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ThemeMode,
  getStoredThemeMode,
  setThemeMode,
  initThemeListener,
  resolveEffectiveTheme,
} from "@/lib/theme";

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useState<ThemeMode>(getStoredThemeMode());
  const [effective, setEffective] = useState<"dark" | "light">(resolveEffectiveTheme(mode));

  useEffect(() => {
    // 初始化系统明暗偏好变化监听
    const cleanup = initThemeListener((eff, currentMode) => {
      setEffective(eff);
      setMode(currentMode);
    });
    return cleanup;
  }, []);

  // 点击循环切换：跟随系统 -> 浅色模式 -> 深色模式 -> 跟随系统
  const handleCycleTheme = () => {
    let nextMode: ThemeMode = "system";
    if (mode === "system") {
      nextMode = "light";
    } else if (mode === "light") {
      nextMode = "dark";
    } else {
      nextMode = "system";
    }

    const newEffective = setThemeMode(nextMode);
    setMode(nextMode);
    setEffective(newEffective);
  };

  const getLabel = () => {
    if (mode === "system") {
      return `跟随系统 (${effective === "dark" ? "深色" : "浅色"})`;
    }
    return mode === "dark" ? "黑夜模式" : "白天模式";
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCycleTheme}
      className="flex items-center gap-1.5 text-xs text-foreground border-border bg-card hover:bg-accent px-2.5 py-1.5 transition-all shadow-sm"
      title={`当前外观: ${getLabel()} (点击切换)`}
    >
      {mode === "system" ? (
        <Laptop size={14} className="text-primary" />
      ) : mode === "dark" ? (
        <Moon size={14} className="text-primary" />
      ) : (
        <Sun size={14} className="text-state-paused" />
      )}
      <span className="font-medium text-[11px]">{getLabel()}</span>
    </Button>
  );
};
