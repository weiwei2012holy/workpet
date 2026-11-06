/**
 * @Author wei
 * @Date 2026-11-03
 * @Description React Bits 灵动流光文字组件，为计时数字与标题赋予金属微光扫描质感
 **/

import React, { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './ShinyText.css';

export interface ShinyTextProps {
  text?: string;
  children?: ReactNode;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  angle?: number;
  shineWidth?: number;
  glow?: number;
  className?: string;
  style?: CSSProperties;
}

const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  children,
  color = '#e2e8f0',
  shineColor = '#38bdf8',
  speed = 2.4,
  delay = 0.5,
  angle = 120,
  shineWidth = 45,
  glow = 0.3,
  className = '',
  style
}) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const content = children ?? text;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let start = performance.now();
    let alive = true;

    const render = (now: number) => {
      if (!alive) return;
      const elapsed = (now - start) / 1000;
      const cycle = speed + delay;
      const progress = (elapsed % cycle) / speed;

      let pos = -50;
      if (progress <= 1) {
        pos = -50 + progress * 200;
      }

      const grad = `linear-gradient(${angle}deg, ${color} 0%, ${color} ${Math.max(
        0,
        pos - shineWidth / 2
      )}%, ${shineColor} ${pos}%, ${color} ${Math.min(100, pos + shineWidth / 2)}%, ${color} 100%)`;

      root.style.backgroundImage = grad;
      if (glowRef.current) {
        glowRef.current.style.backgroundImage = grad;
        glowRef.current.style.opacity = progress <= 1 ? `${glow}` : '0';
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [color, shineColor, speed, delay, angle, shineWidth, glow]);

  return (
    <span
      ref={rootRef}
      className={`shiny-text ${className}`}
      style={{ backgroundImage: `linear-gradient(${color}, ${color})`, ...style }}
    >
      {content}
      {glow > 0 && (
        <span ref={glowRef} className="shiny-text__glow" aria-hidden="true">
          {content}
        </span>
      )}
    </span>
  );
};

export default ShinyText;
