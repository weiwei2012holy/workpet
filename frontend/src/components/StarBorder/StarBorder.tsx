/**
 * @Author wei
 * @Date 2026-11-03
 * @Description React Bits 星尘星轨流光环绕按钮组件
 **/

import React, { useEffect, useRef } from 'react';
import './StarBorder.css';

export interface StarBorderProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  trailColor?: string;
  duration?: number;
  thickness?: number;
  radius?: number;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const StarBorder: React.FC<StarBorderProps> = ({
  children,
  className = '',
  style,
  color = '#ffffff',
  duration = 4000,
  thickness = 1.5,
  radius = 12,
  onClick,
  type = 'button'
}) => {
  const rootRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let alive = true;
    let start = performance.now();

    const render = (now: number) => {
      if (!alive) return;
      const w = root.clientWidth;
      const h = root.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== (w + 48) * dpr || canvas.height !== (h + 48) * dpr) {
        canvas.width = (w + 48) * dpr;
        canvas.height = (h + 48) * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w + 48, h + 48);
      ctx.save();
      ctx.translate(24, 24);

      const elapsed = (now - start) % duration;
      const progress = elapsed / duration;
      const perimeter = (w + h) * 2;
      const dist = progress * perimeter;

      let x = 0, y = 0;
      if (dist < w) {
        x = dist;
        y = 0;
      } else if (dist < w + h) {
        x = w;
        y = dist - w;
      } else if (dist < w * 2 + h) {
        x = w - (dist - (w + h));
        y = h;
      } else {
        x = 0;
        y = h - (dist - (w * 2 + h));
      }

      // 绘制星光轨迹
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 16);
      grad.addColorStop(0, color);
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [color, duration]);

  return (
    <button
      ref={rootRef}
      type={type}
      className={`star-border ${className}`}
      style={
        {
          '--star-border-radius': `${radius}px`,
          '--star-border-thickness': `${thickness}px`,
          ...style
        } as React.CSSProperties
      }
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="star-border__light" aria-hidden="true" />
      {children}
    </button>
  );
};

export default StarBorder;
