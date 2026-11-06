/**
 * @Author wei
 * @Date 2026-11-03
 * @Description React Bits 点击粒子星火组件，在点击窗口任何位置时发射轻盈微光火花
 **/

import React, { useRef, useEffect, ReactNode, CSSProperties } from 'react';

export interface ClickSparkProps {
  sparkColor?: string | string[];
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const ClickSpark: React.FC<ClickSparkProps> = ({
  sparkColor = ['#38bdf8', '#10b981', '#ffffff', '#f59e0b'],
  sparkSize = 8,
  sparkRadius = 26,
  sparkCount = 8,
  duration = 450,
  className = '',
  style,
  children
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let sparks: Array<{
      x: number;
      y: number;
      angle: number;
      speed: number;
      color: string;
      size: number;
      alpha: number;
    }> = [];

    let raf = 0;
    const colors = Array.isArray(sparkColor) ? sparkColor : [sparkColor];

    const resize = () => {
      canvas.width = root.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = root.clientHeight * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.alpha -= 1000 / (duration * 60);

        if (p.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (sparks.length > 0) {
        raf = requestAnimationFrame(loop);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        sparks.push({
          x,
          y,
          angle,
          speed: (sparkRadius / (duration / 16)) * (0.8 + Math.random() * 0.4),
          color,
          size: sparkSize * (0.6 + Math.random() * 0.5),
          alpha: 1
        });
      }

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    root.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', resize);

    return () => {
      root.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [sparkColor, sparkCount, sparkRadius, sparkSize, duration]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 99
        }}
      />
    </div>
  );
};

export default ClickSpark;
