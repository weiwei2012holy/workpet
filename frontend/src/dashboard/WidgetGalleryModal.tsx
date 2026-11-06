/**
 * @Author wei
 * @Date 2026-11-05
 * @Description 小组件画廊弹窗（WidgetGalleryModal），使用 shadcn/ui 官方 Dialog 复合组件与语义化 Tokens 重构
 **/

import React from "react";
import { Plus, Check } from "lucide-react";
import { REGISTERED_METRIC_WIDGETS, REGISTERED_TOOLS } from "../tools/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WidgetGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWidgetIds: string[];
  enabledTools: string[];
  onAddWidget: (widgetId: string) => void;
}

export const WidgetGalleryModal: React.FC<WidgetGalleryModalProps> = ({
  isOpen,
  onClose,
  activeWidgetIds,
  enabledTools,
  onAddWidget,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* 顶部标题栏：遵循 shadcn DialogHeader 与无障碍 Title/Description 规范 */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30 text-left">
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <span>📱</span> 小组件画廊 (Widget Gallery)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            类似手机桌面，自由添加各工具提供的状态卡片与可视化图表到看板
          </DialogDescription>
        </DialogHeader>

        {/* 可用小组件卡片列表：网格容器，严格遵循 flex 与 gap 规范 */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REGISTERED_METRIC_WIDGETS.map((widget) => {
              const isAdded = activeWidgetIds.includes(widget.id);
              const tool = REGISTERED_TOOLS.find((t) => t.id === widget.toolId);
              const isToolEnabled = enabledTools.includes(widget.toolId);

              return (
                <div
                  key={widget.id}
                  className="p-4 rounded-xl border border-border bg-card/60 hover:bg-muted/30 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{widget.icon}</span>
                        <h4 className="text-sm font-semibold text-foreground">
                          {widget.title}
                        </h4>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {widget.size}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {widget.description}
                    </p>
                  </div>

                  {/* 底部操作与归属工具标识 */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {tool?.icon} {tool?.name}
                    </span>

                    {!isToolEnabled ? (
                      <Badge variant="secondary" className="text-[10px]">
                        未启用该工具
                      </Badge>
                    ) : isAdded ? (
                      <Badge variant="outline" className="text-primary border-primary/40 flex items-center gap-1 text-[11px] px-2 py-0.5">
                        <Check className="size-3" />
                        已添加
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onAddWidget(widget.id)}
                        className="h-7 px-3 text-xs flex items-center gap-1 rounded-lg"
                      >
                        <Plus className="size-3.5" />
                        添加
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
