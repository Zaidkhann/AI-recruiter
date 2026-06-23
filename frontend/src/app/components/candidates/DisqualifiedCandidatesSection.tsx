"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  RotateCcw,
  UserX,
} from "lucide-react";
import type { Candidate, RankingAnalytics } from "@/app/lib/types";

interface DisqualifiedCandidatesSectionProps {
  candidates: Candidate[];
  analytics: RankingAnalytics | null;
  onSelectCandidate: (candidate: Candidate) => void;
  onMoveBackToReview: (candidateId: number) => void;
  selectedCandidateId?: number | null;
  overriddenIds: Set<number>;
}

export function DisqualifiedCandidatesSection({
  candidates,
  analytics,
  onSelectCandidate,
  onMoveBackToReview,
  selectedCandidateId,
  overriddenIds,
}: DisqualifiedCandidatesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const visibleCandidates = useMemo(
    () => candidates.filter((c) => !overriddenIds.has(c.id)),
    [candidates, overriddenIds],
  );

  if (visibleCandidates.length === 0 && !analytics) {
    return null;
  }

  const totalProcessed = analytics?.total_processed ?? 0;
  const rankedCount = analytics?.ranked_count ?? 0;
  const disqualifiedCount = analytics?.disqualified_count ?? visibleCandidates.length;

  return (
    <div className="mt-5 border-t border-[#242435] pt-5 space-y-4">
      {/* Filtering analytics strip */}
      {analytics && totalProcessed > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Candidates Processed
            </p>
            <p className="text-xl font-bold text-white mt-1">{totalProcessed}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400/80">
              Ranked
            </p>
            <p className="text-xl font-bold text-emerald-300 mt-1">{rankedCount}</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-400/80">
              Disqualified
            </p>
            <p className="text-xl font-bold text-rose-300 mt-1">{disqualifiedCount}</p>
          </div>
        </div>
      )}

      {visibleCandidates.length > 0 && (
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-b from-rose-950/20 to-[#14141d] overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-rose-500/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <UserX className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-rose-200">
                  Disqualified Candidates ({visibleCandidates.length})
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Auto-filtered by skill match, semantic fit, and overall score thresholds
                </p>
              </div>
            </div>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-rose-300" />
            ) : (
              <ChevronRight className="h-4 w-4 text-rose-300" />
            )}
          </button>

          {expanded && (
            <div className="px-3 pb-3 space-y-2.5 max-h-[420px] overflow-y-auto">
              {visibleCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className={`rounded-xl border bg-slate-900/40 backdrop-blur-md p-5 transition-all duration-300 ${
                    selectedCandidateId === cand.id
                      ? "border-rose-500/60 shadow-lg shadow-rose-950/20 bg-slate-900/60"
                      : "border-rose-500/10 hover:border-rose-500/25 hover:bg-slate-900/50"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => onSelectCandidate(cand)}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-inner">
                          <AlertTriangle className="h-5 w-5 text-rose-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-100 tracking-tight">{cand.name}</h4>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/20">
                              Disqualified
                            </span>
                          </div>

                          {/* Matching progress bar */}
                          <div className="mt-2.5 flex items-center gap-3.5">
                            <div className="flex-1 max-w-[220px] h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-amber-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, cand.final_score * 100))}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-rose-300/90 tracking-wide">
                              {Math.round(cand.final_score * 100)}% Match Score
                            </span>
                          </div>

                          {/* Dynamic detailed disqualification callouts */}
                          {cand.reason && cand.reason.length > 0 && (
                            <div className="mt-3.5 space-y-2">
                              {cand.reason.map((reason, idx) => (
                                <div
                                  key={idx}
                                  className="text-[11px] text-rose-200/90 bg-rose-500/5 border border-rose-500/10 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 leading-relaxed shadow-sm"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Contrasting Skills Section */}
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-3.5">
                            {/* Candidate Skills */}
                            {cand.skills && cand.skills.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                                  Candidate Skills ({cand.skills.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {cand.skills.slice(0, 8).map((skill) => (
                                    <span
                                      key={skill}
                                      className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {cand.skills.length > 8 && (
                                    <span className="text-[10px] text-slate-500 font-semibold self-center pl-1">
                                      +{cand.skills.length - 8} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Missing Required Skills */}
                            {cand.missing_required_skills && cand.missing_required_skills.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                                  Missing Required Skills ({cand.missing_required_skills.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {cand.missing_required_skills.slice(0, 8).map((skill) => (
                                    <span
                                      key={skill}
                                      className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-500/10 text-rose-300 border border-rose-500/15"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {cand.missing_required_skills.length > 8 && (
                                    <span className="text-[10px] text-slate-500 font-semibold self-center pl-1">
                                      +{cand.missing_required_skills.length - 8} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {cand.resume_preview && (
                            <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 flex flex-col gap-1.5">
                              <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-slate-400" /> Resume Excerpt Preview
                              </p>
                              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                                {cand.resume_preview}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveBackToReview(cand.id);
                      }}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/40 hover:text-white transition-all active:scale-95 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Move Back To Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
