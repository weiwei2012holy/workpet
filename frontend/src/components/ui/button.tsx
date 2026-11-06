/**
 * @Author wei
 * @Date 2026-11-04
 * @Description shadcn/ui Button 按钮组件，100% 严谨采用 Tweakcn Cosmic Night 调色规范
 **/

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default:
        "bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
      destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
      outline:
        "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost:
        "text-foreground hover:bg-accent hover:text-accent-foreground",
      link:
        "text-primary underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-9 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-md px-8 text-base",
      icon: "h-8 w-8 rounded-md",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
