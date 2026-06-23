"use client";

import React, { memo, useState } from "react";
import { Code, ChevronRight, ChevronDown, Info, FileText } from "lucide-react";
import type { Candidate } from "@/app/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  candidate: Candidate;
  isSelected: boolean;
  onClick: () => void;
  onViewResume: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const CandidateCard = memo(function CandidateCard({ candidate: cand, isSelected, onClick, onViewResume }: Props) {
  const hasGap = cand.modifiers.team_gap_score > 0.5;
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const getEvidence = (factor: string) => {
    // Attempt to match the factor string with strengths or missing skills
    if (!cand.explanation?.strengths) return "No specific evidence provided.";
    const matches = cand.explanation.strengths.filter((s: string) => s.toLowerCase().includes(factor.toLowerCase()));
    if (matches.length > 0) return matches[0];
    return "Calculated via multi-factor model analysis.";
  };

  const handlePillClick = (e: React.MouseEvent, factor: string) => {
    e.stopPropagation();
    setExpandedFactor(expandedFactor === factor ? null : factor);
  };

  return (
    <div className={`flex flex-col border rounded-xl overflow-hidden transition-all group ${isSelected ? "border-indigo-500 shadow-lg" : "border-[#242435]"}`}>
      <div
        onClick={onClick}
        className={`bg-[#1e1e2d]/60 p-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-[#232338] ${isSelected ? "bg-[#232338]" : ""}`}
      >
      <div className="flex items-start gap-4">
        {/* Rank Circle */}
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shadow ${
            cand.rank === 1
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40"
              : cand.rank === 2
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/40"
                : "bg-slate-700/20 text-slate-400 border border-slate-700/40"
          }`}
        >
          #{cand.rank}
        </div>

        <div className="space-y-1">
          <h4 className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
            {cand.name}
          </h4>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Code className="h-3.5 w-3.5 text-indigo-400" /> github: {cand.github_username}
          </p>

          {/* Skill Tags */}
          <div className="flex flex-wrap gap-1 pt-1.5">
            {cand.skills.slice(0, 4).map((s, i) => (
              <span key={i} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700/30 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {cand.skills.length > 4 && (
              <span className="text-[10px] text-slate-400 font-semibold pl-1">
                +{cand.skills.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 md:mt-0 justify-between md:justify-end border-t md:border-t-0 border-[#242435] pt-3 md:pt-0">
        <div className="flex flex-wrap gap-1.5 md:justify-end">
          {cand.is_llm_verified && (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 px-2 py-0.5 rounded">
              LLM Reranked
            </span>
          )}
          {hasGap && (
            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 px-2 py-0.5 rounded">
              Gap Filler
            </span>
          )}
          {cand.modifiers.transferable_skills > 0.1 && (
            <span className="text-[9px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30 px-2 py-0.5 rounded">
              Hidden Talent
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            title={`View ${cand.name}'s resume`}
            onClick={onViewResume}
            className="h-8 px-2.5 rounded-lg border border-[#34344a] bg-[#14141d] text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-indigo-200 hover:border-indigo-500/60 hover:bg-indigo-500/10 transition-colors flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Resume
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">Match Score</div>
            <div className="text-base font-extrabold text-indigo-400 flex items-center gap-1.5 justify-end">
              {cand.overall_score || Math.round(cand.final_score * 100)}%
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Explainable AI Factor Breakdown Pills */}
      {cand.factor_breakdown && (
        <div className="px-4 pb-3 pt-1 border-t border-[#242435]/50 bg-[#1e1e2d]/40">
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(cand.factor_breakdown).map(([factor, score]) => (
              <button
                key={factor}
                onClick={(e) => handlePillClick(e, factor)}
                className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
                  expandedFactor === factor 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-[#14141d] border-[#242435] text-slate-300 hover:border-indigo-500/50 hover:bg-[#232338]"
                }`}
              >
                <span className="capitalize">{factor}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                  (score as number) >= 80 ? "bg-emerald-500/20 text-emerald-400" : (score as number) >= 60 ? "bg-yellow-500/20 text-yellow-400" : "bg-rose-500/20 text-rose-400"
                }`}>
                  {score as number}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${expandedFactor === factor ? "rotate-180" : ""}`} />
              </button>
            ))}
          </div>

          <AnimatePresence>
            {expandedFactor && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 bg-[#0d0d16] border border-[#242435] rounded-lg p-3 flex gap-2 items-start text-xs text-indigo-200">
                  <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-white capitalize mr-1">{expandedFactor} Evidence:</span>
                    {getEvidence(expandedFactor)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
    </div>
  );
});
