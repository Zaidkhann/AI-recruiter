"use client";

import React from "react";

interface DataQualityBadgeProps {
  source: string;
  quality: string;
  className?: string;
}

export function DataQualityBadge({ source, quality, className = "" }: DataQualityBadgeProps) {
  const icon = source === "cached" ? "📦" : source === "github_api" ? "✓" : source === "partial" ? "◐" : "⚠";
  const colorClasses =
    quality === "verified"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : quality === "partial"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-slate-500/10 text-slate-400 border-slate-500/30";

  const label =
    source === "cached" ? "Cached" :
    source === "github_api" ? "Live API" :
    source === "partial" ? "Partial" :
    "Estimated";

  return (
    <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold border ${colorClasses} ${className}`}>
      <span>{icon}</span> {label} · {quality}
    </span>
  );
}
