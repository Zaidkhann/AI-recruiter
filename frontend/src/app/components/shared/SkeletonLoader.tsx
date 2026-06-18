"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
  lines?: number;
  variant?: "card" | "text" | "chart" | "score";
}

export function Skeleton({ className = "", lines = 3, variant = "text" }: SkeletonProps) {
  if (variant === "card") {
    return (
      <div className={`bg-[#14141d] border border-[#242435] rounded-xl p-5 animate-pulse ${className}`}>
        <div className="h-3 w-24 bg-[#242435] rounded mb-3" />
        <div className="h-7 w-20 bg-[#242435] rounded mb-2" />
        <div className="h-2 w-32 bg-[#1e1e2d] rounded" />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={`bg-[#14141d] border border-[#242435] rounded-xl p-5 animate-pulse ${className}`}>
        <div className="h-3 w-40 bg-[#242435] rounded mb-4" />
        <div className="h-48 bg-[#1a1a28] rounded-lg flex items-end justify-around px-4 pb-4 gap-2">
          {[60, 80, 45, 70, 55, 85].map((h, i) => (
            <div key={i} className="bg-[#242435] rounded-t" style={{ height: `${h}%`, width: "12%" }} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "score") {
    return (
      <div className={`bg-[#14141d] border border-[#242435] rounded-xl p-4 animate-pulse flex items-center gap-3 ${className}`}>
        <div className="h-12 w-12 rounded-full bg-[#242435]" />
        <div className="flex-1">
          <div className="h-2.5 w-20 bg-[#242435] rounded mb-2" />
          <div className="h-4 w-10 bg-[#1e1e2d] rounded" />
        </div>
      </div>
    );
  }

  // Default: text skeleton
  return (
    <div className={`animate-pulse space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-[#242435] rounded"
          style={{ width: `${85 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function CandidateListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[#1e1e2d]/60 border border-[#242435] rounded-xl p-4 animate-pulse flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-[#242435]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 bg-[#242435] rounded" />
            <div className="h-2.5 w-24 bg-[#1e1e2d] rounded" />
            <div className="flex gap-1.5 pt-1">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 w-14 bg-[#242435] rounded-full" />
              ))}
            </div>
          </div>
          <div className="text-right space-y-1.5">
            <div className="h-2.5 w-16 bg-[#1e1e2d] rounded ml-auto" />
            <div className="h-5 w-10 bg-[#242435] rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
