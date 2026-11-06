/**
 * @Author wei
 * @Date 2026-11-04
 * @Description shadcn 工具函数库，合并 className 与 Tailwind 冲突
 **/

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
