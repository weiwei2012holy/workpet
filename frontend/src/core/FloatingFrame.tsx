/**
 * @Author wei
 * @Date 2026-11-03
 * @Description 悬浮挂件通用外壳容器，统一管理深紫罗兰极光渐变背景、SpotlightCard流光光晕与全局按键
 **/

import React, { useEffect } from "react";
import SpotlightCard from "../components/SpotlightCard/SpotlightCard";
import ClickSpark from "../components/ClickSpark/ClickSpark";
import { Service as ActivityService } from "../../bindings/workpet/pkg/tools/activity";

interface FloatingFrameProps {
  isAlerting?: boolean;
  isAway?: boolean;
  children: React.ReactNode;
}

export default function FloatingFrame({ isAlerting = false, isAway = false, children }: FloatingFrameProps) {
  // 全局键盘快捷键调度（Cmd+Q 退出）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        e.stopPropagation();
        ActivityService.Quit();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <ClickSpark
      sparkColor={["#c084fc", "#e879f9", "#a855f7", "#ffffff"]}
      sparkSize={7}
      sparkRadius={24}
      sparkCount={8}
      duration={400}
    >
      <SpotlightCard
        className={`bits-widget-card ${isAlerting ? "is-alerting" : ""}`}
        spotlightColor={
          isAlerting
            ? "rgba(244, 63, 94, 0.45)"
            : isAway
            ? "rgba(56, 189, 248, 0.35)"
            : "rgba(192, 132, 252, 0.35)"
        }
        intensity={0.28}
        spotlightSize={220}
        borderGlow={0.75}
      >
        {children}
      </SpotlightCard>
    </ClickSpark>
  );
}
