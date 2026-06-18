"use client";

import React from "react";
import { Check, X, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

interface TeamHeatmapProps {
  candidateSkills?: string[];
  requiredSkills?: string[];
  teamSkills?: string[]; // union of all skills on the team
}

export function TeamHeatmap({ 
  candidateSkills = [], 
  requiredSkills = [], 
  teamSkills = [] 
}: TeamHeatmapProps) {
  
  const cSkillsLower = candidateSkills.map(s => s.toLowerCase());
  const tSkillsLower = teamSkills.map(s => s.toLowerCase());
  
  // Create a combined list of unique skills to show in rows
  const allSkillsToShow = Array.from(
    new Set([
      ...requiredSkills,
      ...candidateSkills.slice(0, 5), // show some candidate skills
    ])
  ).filter(Boolean);

  // Identify gaps: required but missing on team
  const teamGaps = requiredSkills.filter(s => !tSkillsLower.includes(s.toLowerCase()));
  
  // Gaps filled by candidate
  const gapsFilled = teamGaps.filter(s => cSkillsLower.includes(s.toLowerCase()));
  
  // Coverage ratio
  const gapCoveragePct = teamGaps.length > 0 
    ? Math.round((gapsFilled.length / teamGaps.length) * 100) 
    : 100;

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-lg backdrop-blur-md">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-200">Candidate vs Team Heatmap</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Complementary skill and gap analysis</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Gap Coverage</span>
          <span className="text-lg font-black text-emerald-400">{gapCoveragePct}%</span>
        </div>
      </div>

      {/* Summary progress bar */}
      <div className="mb-5 bg-[#0d0d16] border border-[#242435] rounded-lg p-3">
        <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-semibold">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Team Gaps Addressed
          </span>
          <span>{gapsFilled.length} of {teamGaps.length} gaps filled</span>
        </div>
        <div className="h-2 w-full bg-[#1b1b29] rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" 
            style={{ width: `${gapCoveragePct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
          {gapsFilled.length > 0 
            ? `Candidate introduces critical skills (${gapsFilled.slice(0, 3).join(", ")}) currently missing in the team.`
            : "No critical skill gaps filled or no team gaps identified."}
        </p>
      </div>

      {/* Heatmap Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#242435]">
              <th className="py-2.5 font-bold text-slate-400">Skill / Competency</th>
              <th className="py-2.5 text-center font-bold text-slate-400">Required?</th>
              <th className="py-2.5 text-center font-bold text-slate-400">Team Has</th>
              <th className="py-2.5 text-center font-bold text-slate-400">Candidate Has</th>
              <th className="py-2.5 text-center font-bold text-slate-400">Gap Filled?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242435]/50">
            {allSkillsToShow.map((skill, idx) => {
              const isRequired = requiredSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase());
              const teamHas = tSkillsLower.includes(skill.toLowerCase());
              const candHas = cSkillsLower.includes(skill.toLowerCase());
              const isGap = isRequired && !teamHas;
              const isGapFilled = isGap && candHas;

              return (
                <tr key={idx} className="hover:bg-[#1b1b29]/40 transition-colors">
                  <td className="py-2.5 font-semibold text-slate-200">{skill}</td>
                  
                  {/* Required Column */}
                  <td className="py-2.5 text-center">
                    {isRequired ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                        Yes
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Extra</span>
                    )}
                  </td>

                  {/* Team Has Column */}
                  <td className="py-2.5 text-center">
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${teamHas ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {teamHas ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                  </td>

                  {/* Candidate Has Column */}
                  <td className="py-2.5 text-center">
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${candHas ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                      {candHas ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                  </td>

                  {/* Gap Filled Column */}
                  <td className="py-2.5 text-center">
                    {isGapFilled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                        Gap Filled
                      </span>
                    ) : isGap ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">
                        <ShieldAlert className="w-3 h-3 text-red-400" />
                        Unresolved
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
