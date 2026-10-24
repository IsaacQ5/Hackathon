import type { CSSProperties } from 'react';

/** Expose a player colour to CSS as var(--c). */
export const colorVar = (color: string): CSSProperties => ({ '--c': color }) as CSSProperties;
