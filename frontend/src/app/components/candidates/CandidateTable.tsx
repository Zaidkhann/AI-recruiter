"use client";

import React, { memo } from "react";
import { Globe, Download, FileSpreadsheet } from "lucide-react";
import type { Candidate } from "@/app/lib/types";

interface Props {
  candidates: Candidate[];
  selectedCandidateId: number | null;
  onSelectCandidate: (c: Candidate) => void;
}

// Simple heuristic to add visual flair for tiers similar to the reference image
const getTierForEntity = (name?: string | null): "Global T1" | "Global T3" | null => {
  if (!name) return null;
  const lower = name.toLowerCase();
  const t1Keywords = ["google", "amazon", "meta", "facebook", "apple", "netflix", "microsoft", "stanford", "harvard", "mit", "oxford", "cambridge", "iit", "wharton", "kellogg", "insead", "y-combinator"];
  if (t1Keywords.some(k => lower.includes(k))) return "Global T1";
  return "Global T3";
};

const TierBadge = ({ tier }: { tier: string }) => {
  const isT1 = tier === "Global T1";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ml-1.5 whitespace-nowrap ${
      isT1 
        ? "bg-amber-500/10 text-amber-500 border-amber-500/30" 
        : "bg-slate-500/10 text-slate-400 border-slate-500/30"
    }`}>
      <Globe className="h-2 w-2" />
      {tier}
    </span>
  );
};

export const CandidateTable = memo(function CandidateTable({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
}: Props) {
  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-2xl overflow-hidden shadow-md flex flex-col min-h-0">
      {/* Table Header Area */}
      <div className="flex items-center justify-between p-4 border-b border-[#242435] bg-[#0d0d16]">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-white">Ranked List</h2>
          <span className="text-xs bg-[#1b1b2a] text-slate-300 px-2.5 py-1 rounded-md font-semibold border border-slate-700/50 flex items-center gap-1.5">
            <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Talent Rank for Roles
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#242435] hover:border-indigo-500/50 bg-[#1b1b2a] text-[10px] font-bold text-slate-300 transition-colors uppercase tracking-wider">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            Export to Sheet
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-[#14141d]">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-[#0d0d16]/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 border-b border-[#242435] w-12 text-center">Rank</th>
              <th className="py-3 px-4 border-b border-[#242435] w-64">Resume</th>
              <th className="py-3 px-4 border-b border-[#242435] w-72">Previous Companies</th>
              <th className="py-3 px-4 border-b border-[#242435] min-w-[200px]">Core skills</th>
              <th className="py-3 px-4 border-b border-[#242435] w-64">Education</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242435]/50">
            {candidates.map((cand, index) => {
              const isSelected = cand.id === selectedCandidateId;
              const title = cand.career_history?.[0]?.title || "Software Engineer";
              
              return (
                <tr 
                  key={cand.id}
                  onClick={() => onSelectCandidate(cand)}
                  className={`group cursor-pointer transition-colors hover:bg-indigo-500/5 ${isSelected ? "bg-indigo-500/10" : ""}`}
                >
                  <td className="py-4 px-4 text-center">
                    <span className="text-sm font-bold text-slate-300">{cand.rank || index + 1}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {cand.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {title}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      {cand.career_history && cand.career_history.length > 0 ? (
                        cand.career_history.slice(0, 3).map((job, i) => {
                          const tier = getTierForEntity(job.company);
                          return (
                            <div key={i} className="flex items-center text-xs text-slate-300">
                              <span className="truncate max-w-[160px]" title={job.company}>{job.company}</span>
                              {tier && <TierBadge tier={tier} />}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-500 italic">No history provided</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                      {cand.skills?.slice(0, 8).join(", ")}
                      {cand.skills && cand.skills.length > 8 && " ..."}
                    </p>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      {cand.education && cand.education.length > 0 ? (
                        cand.education.slice(0, 2).map((edu, i) => {
                          const tier = getTierForEntity(edu.school);
                          return (
                            <div key={i} className="flex items-center text-xs text-slate-300">
                              <span className="truncate max-w-[140px]" title={edu.school}>{edu.school}</span>
                              {tier && <TierBadge tier={tier} />}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-500 italic">No education provided</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                  No candidates available to display in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
