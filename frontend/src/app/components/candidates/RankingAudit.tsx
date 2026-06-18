"use client";

import React from "react";
import { 
  FileCheck, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Info 
} from "lucide-react";
import { motion } from "framer-motion";

interface FactorAuditItem {
  label: string;
  raw_score: number;
  weight: number;
  contribution: number;
  contribution_pct: number;
}

interface ModifierAuditItem {
  label: string;
  value: number;
  multiplier: number;
  impact_pct: number;
}

interface RankingAuditProps {
  auditData?: {
    ranking_audit: Record<string, FactorAuditItem>;
    group_summaries: Record<string, {
      avg_score: number;
      total_contribution: number;
      factor_count: number;
      contribution_pct: number;
    }>;
    modifier_breakdown: Record<string, ModifierAuditItem>;
    total_raw_score: number;
    total_final_score: number;
    modifier_impact: string;
    modifier_impact_raw: number;
    top_contributing_factors: { name: string; contribution_pct: number }[];
    weakest_factors: { name: string; raw_score: number }[];
  };
}

export function RankingAudit({ auditData }: RankingAuditProps) {
  if (!auditData) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-[#242435] bg-[#14141d]/50 text-center text-slate-500 text-xs">
        No ranking audit data available. Please rank candidates to see the audit trail.
      </div>
    );
  }

  const {
    ranking_audit = {},
    modifier_breakdown = {},
    total_raw_score = 0,
    total_final_score = 0,
    modifier_impact = "+0%",
    top_contributing_factors = [],
    weakest_factors = [],
  } = auditData;

  const isPositiveImpact = parseFloat(modifier_impact) >= 0;

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-6">
      
      {/* Header and Summary */}
      <div className="flex justify-between items-start border-b border-[#242435] pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <FileCheck className="w-5 h-5 text-indigo-400" />
            Candidate Ranking Audit Trail
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Defensible, factor-by-factor scoring breakdown</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Decision Score</span>
          <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            {Math.round(total_final_score * 100)}/100
          </span>
        </div>
      </div>

      {/* Audit Summary Box */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0d0d16] border border-[#242435] rounded-lg p-3.5">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Raw Profile Fit</span>
          <span className="text-base font-bold text-slate-300 mt-0.5 inline-block">{Math.round(total_raw_score * 100)}/100</span>
        </div>
        
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Modifier Boost</span>
          <span className={`text-base font-bold mt-0.5 inline-flex items-center gap-1 ${isPositiveImpact ? "text-emerald-400" : "text-red-400"}`}>
            {isPositiveImpact ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {modifier_impact}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Decision Verification</span>
          <span className="text-xs font-bold text-emerald-400 mt-1 inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Auditable Decision
          </span>
        </div>
      </div>

      {/* Waterfall Contribution Chart */}
      <div>
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#242435] pb-1.5 mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          Factor Contribution Waterfall
        </h5>
        
        <div className="space-y-3">
          {Object.entries(ranking_audit).map(([key, item]) => {
            const rawPct = Math.round(item.raw_score * 100);
            const contribPct = Math.round(item.contribution * 100);

            return (
              <div key={key} className="flex flex-col gap-1 hover:bg-[#1b1b29]/25 p-1 rounded transition-colors">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-slate-400 text-[10px]">
                    Raw: <strong className="text-slate-200">{rawPct}%</strong> (w = {item.weight}) → Contrib: <strong className="text-indigo-400">{contribPct}%</strong>
                  </span>
                </div>
                {/* Visual stacked progress bars */}
                <div className="h-2 w-full bg-[#1b1b29] rounded-full overflow-hidden flex">
                  {/* Contribution Portion */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${contribPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-indigo-500 rounded-l-full shrink-0"
                  />
                  {/* Remaining Raw Potential Portion */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, rawPct - contribPct)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-indigo-500/20 shrink-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modifiers and Boosts */}
      <div>
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#242435] pb-1.5 mb-3">
          Dynamic Modifiers Applied
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(modifier_breakdown).map(([key, item]) => {
            const valuePct = Math.round(item.value * 100);
            const impactSign = item.impact_pct >= 0 ? "+" : "";

            return (
              <div key={key} className="bg-[#1b1b29] border border-[#2b2b40] rounded-lg p-3 flex flex-col gap-1.5">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate" title={item.label}>
                  {item.label}
                </div>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-xs text-slate-500">x{item.multiplier}</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {impactSign}{item.impact_pct}%
                  </span>
                </div>
                {/* Small indicator bar */}
                <div className="h-1 w-full bg-[#0d0d16] rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${valuePct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Insights (Top Contributors and Weakest Areas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top drivers */}
        <div className="bg-[#0b0b12] border border-[#242435] rounded-lg p-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">
            Top Scoring Drivers
          </span>
          <ul className="space-y-1.5 text-xs">
            {top_contributing_factors.slice(0, 3).map((item, idx) => (
              <li key={idx} className="flex justify-between items-center text-slate-300">
                <span>{item.name}</span>
                <span className="font-semibold text-slate-400">({item.contribution_pct}% contribution)</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weakest Areas */}
        <div className="bg-[#0b0b12] border border-[#242435] rounded-lg p-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block mb-2">
            Missing / Weak Factors
          </span>
          {weakest_factors.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {weakest_factors.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center text-slate-300">
                  <span>{item.name}</span>
                  <span className="font-semibold text-slate-400">({item.raw_score}% score)</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500 italic text-[11px] block">No critical weak areas detected. Candidate matches core profile criteria.</span>
          )}
        </div>
      </div>
    </div>
  );
}
