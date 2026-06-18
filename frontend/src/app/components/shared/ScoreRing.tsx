"use client";

import React from "react";

interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
  color?: string;
}

export function ScoreRing({ score, label, size = 56, color = "#6366f1" }: ScoreRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(1, Math.max(0, score));
  const pct = Math.round(score * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#242435"
            strokeWidth={4}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
          style={{ color }}
        >
          {pct}
        </span>
      </div>
      <span className="text-[10px] text-slate-400 font-medium leading-tight max-w-[80px]">{label}</span>
    </div>
  );
}
