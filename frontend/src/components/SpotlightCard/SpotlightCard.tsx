/**
 * @Author wei
 * @Date 2026-11-03
 * @Description React Bits 聚光灯流光卡片组件，随着光标移动呈现动态高光与边缘微光
 **/

import React, { useEffect, useRef } from 'react';
import './SpotlightCard.css';

export type SpotlightShape = 'circle' | 'beam';

export type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
  intensity?: number;
  spotlightSize?: number;
  softness?: number;
  shape?: SpotlightShape;
  borderGlow?: number;
  proximity?: number;
  smoothing?: number;
  ambient?: boolean;
  flare?: boolean;
  grain?: number;
  theme?: 'dark' | 'light';
};

type Palette = { surface: string; border: string; shadow: string; light: string; fill: number; edge: number };

type Settings = {
  shape: SpotlightShape;
  fill: string;
  edge: string;
  size: number;
  intensity: number;
  borderGlow: number;
  proximity: number;
  smoothing: number;
  ambient: boolean;
  flare: boolean;
  grain: number;
};

const THEMES: Record<'dark' | 'light', Palette> = {
  dark: {
    surface: 'rgba(12, 14, 20, 0.92)',
    border: 'rgba(255, 255, 255, 0.12)',
    shadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
    light: '#38bdf8',
    fill: 1,
    edge: 1
  },
  light: {
    surface: '#ffffff',
    border: 'rgba(24, 24, 27, 0.1)',
    shadow: '0 18px 40px -20px rgba(24, 24, 27, 0.16)',
    light: '#18181b',
    fill: 0.28,
    edge: 0.7
  }
};

const SHAPES: SpotlightShape[] = ['circle', 'beam'];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const falloff = (color: string, softness: number) => {
  const soft = clamp(softness, 0, 1);
  const core = (1 - soft) ** 1.5 * 0.85;
  const stop = (alpha: number, at: number) =>
    `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(2)}%, transparent) ${(at * 100).toFixed(2)}%`;
  const list = [stop(1, 0)];
  for (let i = 0; i <= 14; i++) {
    const t = core + ((1 - core) * i) / 14;
    const g = (t - core) / (1 - core);
    const smooth = 1 - g * g * (3 - 2 * g);
    const glow = Math.exp(-4.6 * g * g) * (1 - g ** 6);
    list.push(stop(smooth + (glow - smooth) * soft, t));
  }
  return list.join(', ');
};

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  style,
  spotlightColor,
  intensity = 0.22,
  spotlightSize = 220,
  softness = 0.7,
  shape = 'circle',
  borderGlow = 0.8,
  proximity = 80,
  smoothing = 0.3,
  ambient = false,
  flare = true,
  grain = 0,
  theme = 'dark',
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLSpanElement>(null);
  const grainRef = useRef<HTMLSpanElement>(null);
  const edgeRef = useRef<HTMLSpanElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const palette = THEMES[theme] ?? THEMES.dark;
  const color = spotlightColor ?? palette.light;
  const form = SHAPES.includes(shape) ? shape : 'circle';
  const settings: Settings = {
    shape: form,
    fill: falloff(color, softness),
    edge: falloff(color, softness * 0.65),
    size: Math.max(1, spotlightSize),
    intensity: clamp(intensity, 0, 1),
    borderGlow: clamp(borderGlow, 0, 1),
    proximity: Math.max(0, proximity),
    smoothing: clamp(smoothing, 0, 1),
    ambient,
    flare,
    grain: clamp(grain, 0, 1)
  };
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const root = rootRef.current;
    const light = lightRef.current;
    const grainEl = grainRef.current;
    const edge = edgeRef.current;
    if (!root || !light || !edge) return;

    let raf = 0;
    let alive = true;
    let last = performance.now();
    const pointer = { x: 0, y: 0, active: false };
    const state = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      presence: 0,
      flare: 0,
      pressed: false,
      visible: false,
      time: 0
    };

    const paint = (s: Settings) => {
      const p = palette;
      const dim = Math.max(root.clientWidth, root.clientHeight, 1);
      const radius = (s.size / 200) * dim;
      const x = state.x;
      const y = state.y;
      const pos = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      const fillOpacity = (s.intensity * state.presence * p.fill).toFixed(3);
      const edgeOpacity = (s.borderGlow * state.presence * p.edge).toFixed(3);

      light.style.opacity = fillOpacity;
      light.style.background = `radial-gradient(${radius.toFixed(1)}px circle at ${pos}, ${s.fill})`;

      if (grainEl) {
        grainEl.style.opacity = (s.grain * state.presence * 0.6).toFixed(3);
      }

      edge.style.opacity = edgeOpacity;
      edge.style.background = `radial-gradient(${(radius * 1.25).toFixed(1)}px circle at ${pos}, ${s.edge})`;
    };

    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      state.time += dt;

      const rect = root.getBoundingClientRect();
      const s = settingsRef.current;
      let tx = state.targetX;
      let ty = state.targetY;
      let target = 0;

      if (pointer.active) {
        tx = pointer.x - rect.left;
        ty = pointer.y - rect.top;
        target = 1;
      }

      const follow = 1 - Math.exp(-dt / (0.015 + s.smoothing * 0.22));
      state.x += (tx - state.x) * follow;
      state.y += (ty - state.y) * follow;
      state.presence += (target - state.presence) * (1 - Math.exp(-dt / 0.1));

      paint(s);
      if (Math.abs(tx - state.x) > 0.1 || Math.abs(target - state.presence) > 0.005) {
        raf = requestAnimationFrame(tick);
      }
    };

    const wake = () => {
      if (raf || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      wake();
    };

    const onLeave = () => {
      pointer.active = false;
      wake();
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    wake();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`spotlight-card ${className}`}
      style={
        {
          '--spotlight-card-surface': palette.surface,
          '--spotlight-card-border': palette.border,
          '--spotlight-card-shadow': palette.shadow,
          ...style
        } as React.CSSProperties
      }
      {...rest}
    >
      <span ref={lightRef} className="spotlight-card__light" aria-hidden="true" />
      <span ref={grainRef} className="spotlight-card__grain" style={{ backgroundImage: NOISE }} aria-hidden="true" />
      {children}
      <span className="spotlight-card__border" aria-hidden="true" />
      <span ref={edgeRef} className="spotlight-card__edge" aria-hidden="true" />
    </div>
  );
};

export default SpotlightCard;
