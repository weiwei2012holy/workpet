/**
 * @Author wei
 * @Date 2026-11-06
 * @Description 全局系统设置视图（SettingsView），100% 严谨采用 Tweakcn Cosmic Night 规范，提供外观主题模式选择与基于 GitHub Releases 的在线自更新
 **/

import React, { useState, useEffect } from "react";
import { Sliders, Power, Keyboard, Sparkles, CheckCircle2, Sun, Moon, Laptop, Palette, ArrowUpCircle, RotateCw } from "lucide-react";
import * as SystemService from "@/../bindings/workpet/pkg/system/service";
import * as UpdateService from "@/../bindings/workpet/pkg/updater/service";
import { UpdateInfo } from "@/../bindings/workpet/pkg/updater/models";
import { Events } from "@wailsio/runtime";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeMode, getStoredThemeMode, setThemeMode, initThemeListener } from "@/lib/theme";
import { UpdateModal } from "./UpdateModal";

interface SettingsViewProps {
  settings: {
    autostart: boolean;
    autostartStatus: boolean;
    autoHideWidget: boolean;
    globalShortcut: string;
    appVersion: string;
  };
  onUpdateSettings: (newSettings: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [autostart, setAutostart] = useState(settings.autostart);
  const [autoHideWidget, setAutoHideWidget] = useState(settings.autoHideWidget);
  const [loading, setLoading] = useState(false);
  const [tipMessage, setTipMessage] = useState<string | null>(null);

  // 外观主题模式
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode());

  // 应用在线自更新状态
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  useEffect(() => {
    // 初始加载当前更新状态
    UpdateService.GetStatus()
      .then((res) => {
        if (res) setUpdateInfo(res);
      })
      .catch(console.error);

    // 监听全局更新生命周期事件
    const unUpdater = Events.On("workpet:updater:status", (evt: any) => {
      const payload: UpdateInfo = evt.data || evt;
      if (payload) {
        setUpdateInfo(payload);
        if (payload.hasUpdate && payload.state === "available") {
          setIsUpdateModalOpen(true);
        }
      }
    });

    const unTheme = initThemeListener((_, mode) => {
      setThemeModeState(mode);
    });

    return () => {
      if (unUpdater) unUpdater();
      if (unTheme) unTheme();
    };
  }, []);

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      const res = await UpdateService.CheckForUpdate();
      setUpdateInfo(res);
      if (res && res.hasUpdate) {
        setIsUpdateModalOpen(true);
      } else {
        setUpdateFeedback(`当前已是最新版本 (${settings.appVersion || "最新"})`);
        setTimeout(() => setUpdateFeedback(null), 3500);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("rate limit") || msg.includes("403")) {
        setUpdateFeedback("GitHub 访问频次暂时受限，请稍候重试");
      } else {
        setUpdateFeedback(`检查更新失败: ${msg}`);
      }
      setTimeout(() => setUpdateFeedback(null), 4000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSelectThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    setThemeModeState(mode);
    setTipMessage(`已切换为: ${mode === "system" ? "跟随系统模式" : mode === "dark" ? "黑夜深空模式" : "白天浅色模式"}`);
    setTimeout(() => setTipMessage(null), 3000);
  };

  const handleToggleAutostart = async (checked: boolean) => {
    setLoading(true);
    try {
      await SystemService.SetAutostart(checked);
      setAutostart(checked);
      onUpdateSettings({ ...settings, autostart: checked });
      setTipMessage(checked ? "已成功设置开机自启动" : "已关闭开机自启动");
      setTimeout(() => setTipMessage(null), 3000);
    } catch (e: any) {
      setTipMessage(`操作失败: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoHide = async (checked: boolean) => {
    await SystemService.SetAutoHideWidget(checked);
    setAutoHideWidget(checked);
    onUpdateSettings({ ...settings, autoHideWidget: checked });
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
      {/* 顶部标题区 */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sliders size={22} className="text-primary" />
          系统偏好与全局设置
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          配置 WorkPet 桌面底层的外观主题、自启行为与快捷键
        </p>
      </div>

      {/* 提示信息 */}
      {tipMessage && (
        <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/30 text-sm text-foreground flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 size={16} className="text-[#4db6ac]" />
          <span>{tipMessage}</span>
        </div>
      )}

      {/* 设置项列表 */}
      <div className="space-y-4 max-w-3xl">
        {/* 外观模式与主题切换 */}
        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5">
                <Palette size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  界面外观与配色模式
                  <Badge variant="outline" className="text-[11px] font-mono px-2 py-0.2">
                    Cosmic Night
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  默认跟随系统深色/浅色偏好自动无缝切换，亦可强制固定
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
            {/* 跟随系统 */}
            <button
              onClick={() => handleSelectThemeMode("system")}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                themeMode === "system"
                  ? "bg-primary/20 border-primary text-foreground shadow-sm"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Laptop size={18} className={themeMode === "system" ? "text-primary" : ""} />
              <span>跟随系统 (默认)</span>
            </button>

            {/* 白天模式 */}
            <button
              onClick={() => handleSelectThemeMode("light")}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                themeMode === "light"
                  ? "bg-primary/20 border-primary text-foreground shadow-sm"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Sun size={18} className={themeMode === "light" ? "text-[#febc2e]" : ""} />
              <span>白天浅色模式</span>
            </button>

            {/* 黑夜模式 */}
            <button
              onClick={() => handleSelectThemeMode("dark")}
              className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                themeMode === "dark"
                  ? "bg-primary/20 border-primary text-foreground shadow-sm"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Moon size={18} className={themeMode === "dark" ? "text-primary" : ""} />
              <span>黑夜深空模式</span>
            </button>
          </div>
        </Card>

        {/* 开机自启动 */}
        <Card className="p-5 flex items-center justify-between border-border bg-card shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5">
              <Power size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                开机自动启动
                {settings.autostartStatus && (
                  <Badge variant="success" className="text-xs px-2 py-0.2">
                    系统服务已生效
                  </Badge>
                )}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                计算机开机登录后自动在托盘后台运行 WorkPet，无需每次手动打开
              </p>
            </div>
          </div>

          <Switch
            disabled={loading}
            checked={autostart}
            onCheckedChange={handleToggleAutostart}
          />
        </Card>

        {/* 随行挂件行为设置 */}
        <Card className="p-5 flex items-center justify-between border-border bg-card shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">随行挂件失焦自动收起</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                当您点击屏幕其他区域时，随行挂件自动淡出隐藏，保持桌面纯净免打扰
              </p>
            </div>
          </div>

          <Switch
            checked={autoHideWidget}
            onCheckedChange={handleToggleAutoHide}
          />
        </Card>

        {/* 全局快捷键说明 */}
        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-start gap-3.5 mb-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5">
              <Keyboard size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">全局操作快捷键</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                在任意应用前台时均可使用快捷键唤醒 WorkPet
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-2.5 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">呼出 / 收起随行挂件</span>
              <kbd className="px-2.5 py-1 rounded-md bg-secondary border border-border font-mono text-xs text-secondary-foreground shadow-sm">
                {settings.globalShortcut || "CmdOrCtrl+Shift+R"}
              </kbd>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">关闭/隐藏控制看板</span>
              <kbd className="px-2.5 py-1 rounded-md bg-secondary border border-border font-mono text-xs text-secondary-foreground shadow-sm">
                Cmd / Ctrl + W
              </kbd>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">完全退出应用程序</span>
              <kbd className="px-2.5 py-1 rounded-md bg-secondary border border-border font-mono text-xs text-secondary-foreground shadow-sm">
                Cmd / Ctrl + Q
              </kbd>
            </div>
          </div>
        </Card>

        {/* 应用版本与在线自更新 */}
        <Card className="p-5 border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary mt-0.5">
                <ArrowUpCircle size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  软件版本与自动更新
                  {settings.appVersion && (
                    <Badge variant="outline" className="text-[11px] font-mono px-2 py-0">
                      {settings.appVersion}
                    </Badge>
                  )}
                  {updateInfo?.hasUpdate && (
                    <Badge variant="default" className="text-[11px] font-mono px-2 py-0 bg-primary text-primary-foreground animate-pulse">
                      有新版本 {updateInfo.latestVersion}
                    </Badge>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground">
                  基于 GitHub Releases 分发，支持一键在线检测、无锁原子替换与平滑重启
                </p>
                {updateFeedback && (
                  <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-[#4db6ac]" />
                    <span>{updateFeedback}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {updateInfo?.hasUpdate ? (
                <Button
                  size="sm"
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="text-xs flex items-center gap-1.5 shadow-sm bg-primary text-primary-foreground"
                >
                  <ArrowUpCircle size={14} />
                  <span>查看并更新 ({updateInfo.latestVersion})</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCheckingUpdate}
                  onClick={handleCheckUpdate}
                  className="text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCw size={13} className={isCheckingUpdate ? "animate-spin text-primary" : ""} />
                  <span>{isCheckingUpdate ? "正在检查..." : "检查更新"}</span>
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 关于 WorkPet */}
        <Card className="p-5 border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground text-sm">
              WorkPet 桌面智能效率中心 {settings.appVersion}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              基于 Wails v3, React, TailwindCSS 与 Tweakcn Cosmic Night 调色规范
            </p>
          </div>
          <span className="text-2xl">🌌</span>
        </Card>
      </div>

      {/* 在线自更新详情弹窗 */}
      <UpdateModal
        open={isUpdateModalOpen}
        onOpenChange={setIsUpdateModalOpen}
        info={updateInfo}
      />
    </div>
  );
};
