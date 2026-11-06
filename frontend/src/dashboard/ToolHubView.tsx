/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 工具箱管理视图（ToolHubView），支持午休/下班长时间离座判定阈值配置传递，100% 严谨采用 Tweakcn Cosmic Night 调色规范
 **/

import React, { useState } from "react";
import { Wrench, Settings, ShieldCheck, Clock } from "lucide-react";
import { REGISTERED_TOOLS } from "../tools/registry";
import { ActivitySettingsModal } from "../tools/activity/ActivitySettingsModal";
import { DateConverterModal } from "../tools/datetime/DateConverterModal";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ToolHubViewProps {
  enabledTools: string[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
  activityConfig: {
    intervalMinutes: number;
    idleThresholdMinutes: number;
    offDutyThresholdMinutes?: number;
  };
  onActivityConfigSaved: (interval: number, idleThreshold: number, offDutyThreshold: number) => void;
}

export const ToolHubView: React.FC<ToolHubViewProps> = ({
  enabledTools,
  onToggleTool,
  activityConfig,
  onActivityConfigSaved,
}) => {
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* 顶部标题区 */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wrench size={22} className="text-primary" />
          工具箱与插件管理
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          集中管理 WorkPet 桌面端所支持的功能插件，支持自由开启、禁用及深度设置
        </p>
      </div>

      {/* 工具列表卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {REGISTERED_TOOLS.map((tool) => {
          const isEnabled = enabledTools.includes(tool.id);

          return (
            <Card
              key={tool.id}
              className={`p-5 flex flex-col justify-between transition-all ${
                isEnabled
                  ? "bg-card border-border shadow-sm hover:border-primary/50"
                  : "bg-muted/40 border-border/50 opacity-60"
              }`}
            >
              <div>
                {/* 头部图标与启闭开关 */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-xl shadow-inner">
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        {tool.name}
                        {isEnabled && (
                          <Badge variant="success" className="text-xs px-2 py-0.2">
                            运行中
                          </Badge>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 block">
                        插件标识: {tool.id}
                      </span>
                    </div>
                  </div>

                  {/* 启闭 Switch */}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => onToggleTool(tool.id, checked)}
                  />
                </div>

                {/* 描述信息 */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {tool.description}
                </p>
              </div>

              {/* 底部操作与配置 */}
              <div className="flex items-center justify-between pt-3.5 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>内置官方插件</span>
                </div>

                {tool.id === "activity" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsActivityModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border-border text-foreground hover:bg-accent"
                  >
                    <Settings size={13} />
                    <span>配置参数</span>
                  </Button>
                ) : tool.id === "datetime" ? (
                  <Button
                    size="sm"
                    onClick={() => setIsDateTimeModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  >
                    <Clock size={13} />
                    <span>打开转换器</span>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground font-mono">
                    更多设置开发中
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 活动追踪设置弹窗 */}
      <ActivitySettingsModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        currentInterval={activityConfig.intervalMinutes}
        currentIdleThreshold={activityConfig.idleThresholdMinutes}
        currentOffDutyThreshold={activityConfig.offDutyThresholdMinutes || 30}
        onSaved={onActivityConfigSaved}
      />

      {/* 日期与时间戳转换工作台弹窗 */}
      <DateConverterModal
        isOpen={isDateTimeModalOpen}
        onClose={() => setIsDateTimeModalOpen(false)}
      />
    </div>
  );
};
