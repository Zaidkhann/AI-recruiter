"use client";

import React from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Lightbulb, 
  FileSearch,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";

interface ExplanationCardProps {
  explanation?: {
    why_ranked?: string | string[];
    strengths?: string[];
    risks?: string[];
    missing_skills?: {
      critical_missing_skills?: string[];
      nice_to_have_missing_skills?: string[];
    } | string[];
    transferable_skills?: string[];
    interview_questions?: {
      technical?: string[] | { question: string }[];
      behavioral?: string[] | { question: string }[];
      role_specific?: string[] | { question: string }[];
    } | any[];
    recommended_action?: string;
  };
}

export function ExplanationCard({ explanation }: ExplanationCardProps) {
  if (!explanation) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-[#242435] bg-[#14141d]/50 text-center text-slate-500 text-xs">
        No explanation card data available. Rank candidates to generate.
      </div>
    );
  }

  // Normalize fields
  const whyRankedList = Array.isArray(explanation.why_ranked) 
    ? explanation.why_ranked 
    : explanation.why_ranked 
      ? [explanation.why_ranked] 
      : ["Evaluated based on semantic fit and technical trajectory matching."];

  const strengths = explanation.strengths || [];
  const risks = explanation.risks || [];
  
  // Missing skills normalization
  let criticalMissing: string[] = [];
  let niceMissing: string[] = [];
  if (explanation.missing_skills) {
    if (Array.isArray(explanation.missing_skills)) {
      criticalMissing = explanation.missing_skills;
    } else if (typeof explanation.missing_skills === "object") {
      criticalMissing = explanation.missing_skills.critical_missing_skills || [];
      niceMissing = explanation.missing_skills.nice_to_have_missing_skills || [];
    }
  }

  const transferable = explanation.transferable_skills || [];

  // Interview focus normalization
  let techQuestions: string[] = [];
  let behQuestions: string[] = [];
  if (explanation.interview_questions) {
    if (Array.isArray(explanation.interview_questions)) {
      techQuestions = explanation.interview_questions.map((q: any) => typeof q === "string" ? q : q.question || "");
    } else if (typeof explanation.interview_questions === "object") {
      const tech = explanation.interview_questions.technical || [];
      const beh = explanation.interview_questions.behavioral || [];
      techQuestions = tech.map((q: any) => typeof q === "string" ? q : q.question || "");
      behQuestions = beh.map((q: any) => typeof q === "string" ? q : q.question || "");
    }
  }

  const action = explanation.recommended_action || "Consider";

  const getActionColor = (act: string) => {
    switch (act.toLowerCase()) {
      case "strong hire": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "interview": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "reject": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-xl backdrop-blur-md relative overflow-hidden flex flex-col gap-5">
      {/* Top action and header */}
      <div className="flex justify-between items-center border-b border-[#242435] pb-3">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-indigo-400" />
          <h4 className="text-sm font-bold text-slate-100">AI Recruiter Explanation Card</h4>
        </div>
        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getActionColor(action)}`}>
          {action}
        </span>
      </div>

      {/* WHY RANKED */}
      <div>
        <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-indigo-400" />
          Why Ranked
        </h5>
        <div className="space-y-2 bg-[#0d0d16] border border-[#242435] rounded-lg p-3">
          {whyRankedList.map((reason, idx) => (
            <div key={idx} className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">{reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* STRENGTHS & RISKS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-lg p-3">
          <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Key Strengths
          </h5>
          {strengths.length > 0 ? (
            <ul className="space-y-2">
              {strengths.map((str, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 leading-tight">{str}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[11px] text-slate-500 italic">No specific strengths annotated.</span>
          )}
        </div>

        {/* Risks */}
        <div className="bg-amber-500/[0.02] border border-amber-500/10 rounded-lg p-3">
          <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Potential Risks
          </h5>
          {risks.length > 0 ? (
            <ul className="space-y-2">
              {risks.map((risk, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300 leading-tight">{risk}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[11px] text-slate-500 italic">No specific risk signals detected.</span>
          )}
        </div>
      </div>

      {/* MISSING VS TRANSFERABLE SKILLS */}
      <div className="bg-[#0b0b12] border border-[#242435] rounded-lg p-3">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
          Skill Gap Analysis
        </h5>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Missing Required Skills
            </span>
            {criticalMissing.length > 0 || niceMissing.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {criticalMissing.map((skill, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    {skill} (critical)
                  </span>
                ))}
                {niceMissing.map((skill, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/10">
                    {skill} (nice-to-have)
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 italic block">No missing required skills.</span>
            )}
          </div>

          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Transferable Adjacent Skills
            </span>
            {transferable.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {transferable.map((skill, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 italic block">No transferable skill overlaps.</span>
            )}
          </div>
        </div>
      </div>

      {/* INTERVIEW FOCUS */}
      {(techQuestions.length > 0 || behQuestions.length > 0) && (
        <div>
          <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Interview Focus Areas
          </h5>
          <div className="space-y-2">
            {techQuestions.slice(0, 2).map((q, idx) => (
              <div key={idx} className="p-2.5 bg-[#1b1b29] border border-[#2b2b40] rounded-lg text-xs">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                  Technical Validation {idx + 1}
                </span>
                <p className="text-slate-300 font-medium leading-relaxed">{q}</p>
              </div>
            ))}
            
            {behQuestions.slice(0, 1).map((q, idx) => (
              <div key={idx} className="p-2.5 bg-[#1b1b29] border border-[#2b2b40] rounded-lg text-xs">
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                  Behavioral/Leadership Validation
                </span>
                <p className="text-slate-300 font-medium leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
