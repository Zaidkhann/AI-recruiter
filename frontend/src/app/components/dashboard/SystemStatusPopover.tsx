"use client";

import React, { memo, useState } from "react";
import type { SystemStatus } from "@/app/lib/types";

interface Props {
  status: SystemStatus;
}

export const SystemStatusPopover = memo(function SystemStatusPopover({ status }: Props) {
  const [open, setOpen] = useState(false);
  const isFallback = status.mode === "fallback";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-slate-800 ${
          isFallback
            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isFallback ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          }`}
        />
        System Status: {isFallback ? "Fallback" : "Live"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-[#11111b] border border-[#242435] rounded-xl p-4 shadow-2xl z-50 animate-fade-in text-xs space-y-2.5">
          <h4 className="font-bold text-white border-b border-[#242435] pb-1.5 flex items-center justify-between">
            <span>System Status</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${
                isFallback
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}
            >
              {status.mode}
            </span>
          </h4>
          <div className="space-y-1.5">
            <Row label="Database" value={status.database} />
            <Row label="Cache" value={status.cache} />
            <Row label="Vector" value={status.vector} />
            <div className="flex justify-between">
              <span className="text-slate-400">LLM:</span>
              <span
                className={`font-semibold uppercase ${
                  status.llm === "connected" ? "text-indigo-400" : "text-rose-400"
                }`}
              >
                {status.llm === "connected" ? "Gemini" : "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#242435] pt-1.5 mt-1.5">
              <span className="text-slate-400">Mode:</span>
              <span className="font-bold text-white uppercase">
                {isFallback ? "Fallback" : "Live"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold text-white uppercase">{value}</span>
    </div>
  );
}
