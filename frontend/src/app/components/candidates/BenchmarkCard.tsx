"use client";

import React from "react";
import { Award, Zap, Building2, Flame } from "lucide-react";
import { motion } from "framer-motion";

interface BenchmarkCardProps {
  benchmarkData?: {
    global_percentile: number;
    category_percentiles: Record<string, number>;
    benchmark_match: Record<string, number>;
    top_category: string;
    narrative: string;
  };
}

export function BenchmarkCard({ benchmarkData }: BenchmarkCardProps) {
  if (!benchmarkData) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-[#242435] bg-[#14141d]/50 text-center text-slate-500 text-xs">
        No benchmarking data available. Compute rankings to view.
      </div>
    );
  }

  const {
    global_percentile = 50,
    category_percentiles = { backend: 50, frontend: 50, ai: 50 },
    benchmark_match = { YC_FOUNDING_ENGINEER: 50, FAANG_STAFF: 50 },
    top_category = "backend",
    narrative = "Global average",
  } = benchmarkData;

  // Tier calculation helper
  const getTier = (pct: number) => {
    if (pct >= 95) return { label: "Elite Tier (Top 5%)", color: "from-amber-400 to-yellow-500", text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" };
    if (pct >= 90) return { label: "Principal Tier (Top 10%)", color: "from-indigo-400 to-purple-500", text: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" };
    if (pct >= 75) return { label: "Premium Tier (Top 25%)", color: "from-emerald-400 to-teal-500", text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" };
    return { label: "Standard Tier", color: "from-slate-400 to-slate-500", text: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20" };
  };

  const tier = getTier(global_percentile);

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex justify-between items-start mb-4 gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-200">Candidate Benchmarking</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">{narrative}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tier.bg} ${tier.text} ${tier.border}`}>
          {tier.label}
        </span>
      </div>

      {/* Global Percentile Ring/Bar */}
      <div className="mb-5 bg-[#0d0d16] border border-[#242435] rounded-lg p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Global Percentile</div>
            <div className="text-lg font-extrabold text-slate-100 mt-0.5">Top {100 - global_percentile}%</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            {global_percentile}th
          </div>
          <div className="text-[9px] text-slate-400 font-medium">percentile rank</div>
        </div>
      </div>

      {/* Category Percentiles */}
      <div className="space-y-3 mb-5">
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#242435] pb-1">
          Role Percentiles
        </h5>
        
        {Object.entries(category_percentiles).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1 capitalize">
              <span>{key === "ai" ? "AI / ML Engineer" : `${key} engineer`}</span>
              <span className="text-slate-400">{val}%</span>
            </div>
            <div className="h-1.5 w-full bg-[#1b1b29] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${val}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full bg-gradient-to-r ${
                  key === top_category ? "from-indigo-500 to-purple-500" : "from-slate-500 to-slate-400"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Benchmark Bars (YC, FAANG) */}
      <div className="space-y-2.5">
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#242435] pb-1">
          Industry Standards Comparison
        </h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1b1b29] border border-[#2c2c3e] rounded-lg p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[9px] text-slate-400 font-bold">YC FOUNDER FIT</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">{benchmark_match.YC_FOUNDING_ENGINEER}% compatibility</div>
            </div>
          </div>
          
          <div className="bg-[#1b1b29] border border-[#2c2c3e] rounded-lg p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[9px] text-slate-400 font-bold">FAANG STAFF BAR</div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">{benchmark_match.FAANG_STAFF}% compatibility</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
