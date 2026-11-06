/**
 * @Author wei
 * @Date 2026-11-05
 * @Description 仪表盘视图（DashboardView），使用 shadcn/ui 标准组件体系（Tooltip/Separator/Button/Badge）重构
 **/

import React, { useState } from "react";
import { Plus, LayoutGrid, Sparkles, X, GripHorizontal } from "lucide-react";
import { REGISTERED_METRIC_WIDGETS } from "../tools/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DashboardViewProps {
  widgetIds: string[];
  enabledTools: string[];
  stats: any;
  reminderState: any;
  onRemoveWidget: (id: string) => void;
  onReorderWidgets?: (newWidgetIds: string[]) => void;
  onOpenGallery: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  widgetIds,
  enabledTools,
  stats,
  reminderState,
  onRemoveWidget,
  onReorderWidgets,
  onOpenGallery,
}) => {
  // 拖拽排序状态管理
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 过滤出当前启用的工具对应的小组件（严格保持当前排序）
  const visibleWidgets = widgetIds
    .map((id) => REGISTERED_METRIC_WIDGETS.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => {
      if (!w) return false;
      return enabledTools.includes(w.toolId);
    });

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // 拖拽进入目标组件
  const handleDragEnter = (id: string) => {
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // 放置释放：计算新排序并保存
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentList = [...widgetIds];
    const dragIdx = currentList.indexOf(draggedId);
    const targetIdx = currentList.indexOf(targetId);

    if (dragIdx !== -1 && targetIdx !== -1) {
      currentList.splice(dragIdx, 1);
      currentList.splice(targetIdx, 0, draggedId);
      onReorderWidgets?.(currentList);
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">
        {/* 顶部看板横幅与操作区：精炼标题与纯加号添加按钮 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <LayoutGrid className="size-5 text-primary" />
                指标看板
              </h2>
              <Badge variant="default" className="text-xs px-2 py-0.5 flex items-center gap-1 bg-primary text-primary-foreground font-medium">
                <Sparkles className="size-3" />
                <span>实时</span>
              </Badge>
            </div>

            {/* 添加小组件按钮：规范 Tooltip 包装 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onOpenGallery}
                  size="icon"
                  className="size-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-transform active:scale-95"
                >
                  <Plus className="size-4" />
                  <span className="sr-only">添加小组件</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>添加小组件</span>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator />
        </div>

        {/* 小组件网格系统 (Widget Grid) */}
        {visibleWidgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
            {visibleWidgets.map((widgetDef) => {
              const isSpan2 = widgetDef.size === "2x1";
              const isDragging = draggedId === widgetDef.id;
              const isOver = dragOverId === widgetDef.id && !isDragging;

              return (
                <div
                  key={widgetDef.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, widgetDef.id)}
                  onDragOver={handleDragOver}
                  onDragEnter={() => handleDragEnter(widgetDef.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, widgetDef.id)}
                  className={cn(
                    "relative group/widget cursor-grab active:cursor-grabbing transition-all duration-200 select-none",
                    isSpan2 ? "col-span-1 md:col-span-2" : "col-span-1",
                    isDragging && "opacity-30 scale-95 ring-2 ring-dashed ring-primary rounded-xl",
                    isOver && "ring-2 ring-primary ring-offset-4 ring-offset-background scale-[1.02] rounded-xl shadow-lg"
                  )}
                >
                  {/* 1. 规范外置删除按钮：采用 shadcn Button (destructive) 配合 Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveWidget(widgetDef.id);
                        }}
                        className="absolute -top-2.5 -right-2.5 z-30 opacity-0 group-hover/widget:opacity-100 transition-all duration-200 size-6 rounded-full shadow-lg border-2 border-background p-0 hover:scale-110 active:scale-90"
                      >
                        <X className="size-3" strokeWidth={3} />
                        <span className="sr-only">从看板移除此组件</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>移除组件</span>
                    </TooltipContent>
                  </Tooltip>

                  {/* 2. 顶部微手柄提示（hover 时优雅浮现，建立可拖拽直觉认知） */}
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/widget:opacity-85 transition-opacity px-2.5 py-0.5 rounded-full bg-muted border border-border shadow-sm text-muted-foreground flex items-center gap-1 pointer-events-none text-[10px]"
                  >
                    <GripHorizontal className="size-3" />
                    <span>按住拖拽排序</span>
                  </div>

                  {/* 3. 实际指标组件内容渲染 */}
                  <div className="w-full h-full pointer-events-auto">
                    {widgetDef.render({
                      stats,
                      reminderState,
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 空看板引导：符合 shadcn 规范的空状态 */
          <div className="flex flex-col items-center justify-center py-20 px-6 rounded-xl border-2 border-dashed border-border bg-card/40 text-center gap-4">
            <div className="size-14 rounded-xl bg-muted border border-border flex items-center justify-center text-3xl shadow-sm">
              ✨
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-base font-bold text-foreground">
                看板当前暂未放置小组件
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                您可以随时从组件库中挑选关注的工作专注时长、24小时走势图或作息健康卡片。
              </p>
            </div>
            <Button
              onClick={onOpenGallery}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold mt-2"
            >
              <Plus className="size-4" />
              挑选并添加组件
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
