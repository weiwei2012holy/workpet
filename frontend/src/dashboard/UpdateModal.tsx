/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 遵循 shadcn/ui 规范的应用在线自更新对话框，展示 Release Notes、下载进度条并支持一键重启热替换
 **/

import React from "react";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UpdateInfo } from "@/../bindings/workpet/pkg/updater/models";
import * as UpdateService from "@/../bindings/workpet/pkg/updater/service";

interface UpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: UpdateInfo | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  onOpenChange,
  info,
}) => {
  if (!info) return null;

  const isDownloading = info.state === "downloading";
  const isReady = info.state === "ready";
  const isError = info.state === "error";

  const formatBytes = (bytes: number) => {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleDownload = async () => {
    try {
      await UpdateService.StartDownloadAndInstall();
    } catch (e) {
      console.error("启动下载失败:", e);
    }
  };

  const handleRestart = async () => {
    try {
      await UpdateService.RestartAndApply();
    } catch (e) {
      console.error("重启应用失败:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card text-card-foreground shadow-2xl p-6 sm:rounded-2xl">
        <DialogHeader className="flex flex-col gap-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              发现 WorkPet 新版本
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
            <span className="font-mono">{info.currentVersion}</span>
            <ArrowRight size={12} className="text-muted-foreground" />
            <Badge variant="default" className="text-[11px] font-mono px-2 py-0 bg-primary text-primary-foreground">
              {info.latestVersion || "新版本"}
            </Badge>
            {info.publishedAt && (
              <span className="ml-auto text-[11px] text-muted-foreground">
                发布于 {info.publishedAt}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* 更新说明 / 日志区 */}
        <div className="flex flex-col gap-2.5 my-2">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>更新日志说明</span>
            {info.artifactSize > 0 && (
              <span className="text-[11px] font-normal text-muted-foreground">
                安装包大小: {formatBytes(info.artifactSize)}
              </span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg bg-muted/40 border border-border/80 p-3 text-xs leading-relaxed text-muted-foreground font-sans whitespace-pre-wrap select-text">
            {info.releaseNotes || info.releaseName || "优化多项桌面效率工具性能与修复已知缺陷。"}
          </div>
        </div>

        {/* 下载中 / 就绪进度展示 */}
        {(isDownloading || isReady || isError) && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                {isDownloading && <RefreshCw size={14} className="animate-spin text-primary" />}
                {isReady && <CheckCircle2 size={14} className="text-[#4db6ac]" />}
                {isError && <AlertTriangle size={14} className="text-destructive" />}
                {isDownloading && "正在下载更新中..."}
                {isReady && "下载验证完成，新版本已暂存就绪"}
                {isError && "更新下载失败"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {isDownloading && `${info.progress.toFixed(0)}%`}
                {isReady && "100%"}
              </span>
            </div>

            <Progress value={info.progress} className="h-2 w-full bg-muted" />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>
                {formatBytes(info.bytesWritten)} / {formatBytes(info.totalBytes || info.artifactSize)}
              </span>
              {isDownloading && info.downloadRate > 0 && (
                <span>{formatBytes(info.downloadRate)}/s</span>
              )}
            </div>

            {isError && info.errorMessage && (
              <p className="text-[11px] text-destructive mt-1 font-mono break-all">
                {info.errorMessage}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          {!isDownloading && !isReady && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              稍后更新
            </Button>
          )}

          {!isDownloading && !isReady && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Download size={14} />
              <span>立即下载并更新</span>
            </Button>
          )}

          {isDownloading && (
            <Button disabled variant="outline" size="sm" className="text-xs">
              下载中，请稍候...
            </Button>
          )}

          {isReady && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRestart}
              className="text-xs bg-[#4db6ac] hover:bg-[#39a096] text-white flex items-center gap-1.5 shadow-md"
            >
              <RefreshCw size={14} />
              <span>立即重启应用新版本</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
