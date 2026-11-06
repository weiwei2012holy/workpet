/**
 * @Author wei
 * @Date 2026-11-04
 * @Description shadcn/ui Badge 徽章组件，100% 严谨采用 Tweakcn Cosmic Night 调色规范
 **/

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "away";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    outline: "border-border text-foreground",
    success: "border-transparent bg-[#4db6ac]/20 text-[#4db6ac] border border-[#4db6ac]/40",
    away: "border-transparent bg-[#64b5f6]/20 text-[#64b5f6] border border-[#64b5f6]/40",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
