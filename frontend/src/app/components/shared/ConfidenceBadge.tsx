"use client";

import React, { useState } from "react";
import { ShieldCheck, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfidenceBadgeProps {
  score: number; // 0 to 100
  factors?: {
    resume_text?: boolean;
    github_stats?: boolean;
    linkedin_stats?: boolean;
    career_history?: boolean;
  };
}

export function ConfidenceBadge({ score = 70, factors }: ConfidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Define colors based on score
  const getColors = (val: number) => {
    if (val >= 80) return { stroke: "#10b981", bg: "bg-emerald-500/10", text: "text-emerald-400" }; // Green
    if (val >= 50) return { stroke: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400" };  // Yellow
    return { stroke: "#ef4444", bg: "bg-red-500/10", text: "text-red-400" };     // Red
  };

  const colors = getColors(score);
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center gap-1.5 z-20">
      <div 
        className="relative cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <svg width="32" height="32" className="-rotate-90">
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke="#242435"
            strokeWidth="2.5"
          />
          <motion.circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-300">
          {score}%
        </span>
      </div>

      <div 
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${colors.bg} ${colors.text}`}
      >
        <ShieldCheck className="w-3 height-3" />
        <span>Confidence</span>
      </div>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-3 bg-[#181825] border border-[#2b2b40] rounded-lg shadow-xl backdrop-blur-md text-slate-200 text-xs font-normal"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-100 mb-1.5 border-b border-[#242435] pb-1">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Confidence Factors</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
              Confidence score represents the depth and verification status of this candidate profile.
            </p>
            <ul className="space-y-1 text-[10px]">
              <li className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${score >= 70 ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                <span className="text-slate-300">Resume parsed successfully</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${score >= 80 ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                <span className="text-slate-300">GitHub account verified & fetched</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${score >= 60 ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                <span className="text-slate-300">LinkedIn intelligence scores active</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${score >= 90 ? "bg-emerald-400" : "bg-slate-500"}`}></span>
                <span className="text-slate-300">Multi-year career trajectory depth</span>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
