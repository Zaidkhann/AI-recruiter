"use client";

import React, { memo } from "react";
import { Users, RefreshCw, AlertCircle, X, FileText, LayoutGrid, List, Download } from "lucide-react";
import type { Candidate, Job } from "@/app/lib/types";
import { CandidateCard } from "./CandidateCard";
import { CandidateTable } from "./CandidateTable";
import { CandidateListSkeleton } from "@/app/components/shared/SkeletonLoader";
import { CandidateComparisonModal } from "./CandidateComparisonModal";
import { getApiUrl } from "@/app/lib/api";

interface Props {
  candidates: Candidate[];
  activeJob: Job;
  isRanking: boolean;
  rankingError: string | null;
  selectedCandidateId: number | null;
  onSelectCandidate: (c: Candidate) => void;
  onRetry: () => void;
}

interface CandidateResumeResponse {
  id: number;
  name: string;
  resume_text?: string | null;
}

export const CandidateList = memo(function CandidateList({
  candidates,
  activeJob,
  isRanking,
  rankingError,
  selectedCandidateId,
  onSelectCandidate,
  onRetry,
}: Props) {
  const [compareMode, setCompareMode] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"card" | "table">("table");
  const [compareSelected, setCompareSelected] = React.useState<Candidate[]>([]);
  const [showCompareModal, setShowCompareModal] = React.useState(false);
  const [resumeViewer, setResumeViewer] = React.useState<{
    candidateName: string;
    resumeText: string;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const toggleCompareSelection = (c: Candidate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareSelected.find(cand => cand.id === c.id)) {
      setCompareSelected(compareSelected.filter(cand => cand.id !== c.id));
    } else {
      if (compareSelected.length < 2) {
        setCompareSelected([...compareSelected, c]);
      } else {
        setCompareSelected([compareSelected[1], c]); // keep last 2
      }
    }
  };

  const handleDownloadCSV = () => {
    if (candidates.length === 0) {
      alert("No candidates to download");
      return;
    }

    const headers = ["Rank", "Name", "Role", "Previous Companies", "Core Skills", "Education"];
    const csvRows = [headers.join(",")];

    candidates.forEach((cand, index) => {
      const rank = cand.rank || index + 1;
      const name = `"${cand.name.replace(/"/g, '""')}"`;
      const role = `"${(cand.career_history?.[0]?.title || "Software Engineer").replace(/"/g, '""')}"`;
      const companies = `"${(cand.career_history?.map(j => j.company).join("; ") || "").replace(/"/g, '""')}"`;
      const skills = `"${(cand.skills?.join(", ") || "").replace(/"/g, '""')}"`;
      const education = `"${(cand.education?.map(e => e.school).join("; ") || "").replace(/"/g, '""')}"`;

      csvRows.push([rank, name, role, companies, skills, education].join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "talent_rank_candidates.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const openResumeViewer = async (candidate: Candidate, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setResumeViewer({
      candidateName: candidate.name,
      resumeText: "",
      loading: true,
      error: null,
    });

    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${getApiUrl()}/api/candidates/${candidate.id}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unable to load resume." }));
        setResumeViewer({
          candidateName: candidate.name,
          resumeText: "",
          loading: false,
          error: err.detail || "Unable to load resume.",
        });
        return;
      }

      const data = (await res.json()) as CandidateResumeResponse;
      setResumeViewer({
        candidateName: data.name || candidate.name,
        resumeText: data.resume_text?.trim() || "No resume text is stored for this candidate.",
        loading: false,
        error: null,
      });
    } catch {
      setResumeViewer({
        candidateName: candidate.name,
        resumeText: "",
        loading: false,
        error: "Could not reach the candidate service.",
      });
    }
  };

  return (
    <section className="lg:col-span-7 bg-[#14141d] border border-[#242435] rounded-2xl p-5 shadow-md flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#242435] pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Hiring Pipeline for:{" "}
            <span className="text-indigo-300 font-semibold">{activeJob.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Showing ranked candidates based on active weights.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRanking && (
            <span className="text-xs text-indigo-400 flex items-center gap-2 animate-pulse font-medium">
              <RefreshCw className="h-3 w-3 animate-spin" /> Recalculating...
            </span>
          )}
          <div className="flex bg-[#1b1b2a] rounded-lg p-0.5 border border-[#242435]">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-[#2a2a3f] text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "card" ? "bg-[#2a2a3f] text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
              title="Card View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          {candidates.length > 0 && (
            <button 
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/10 hover:bg-emerald-600/20 text-[10px] font-bold text-emerald-400 transition-colors uppercase tracking-wider active:scale-95"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          )}
          {candidates.length > 1 && viewMode === "card" && (
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setCompareSelected([]);
              }}
              className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider transition-colors ${compareMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#1b1b2a] border-[#242435] text-slate-300 hover:border-indigo-500/50'}`}
            >
              {compareMode ? 'Cancel Compare' : 'Compare Mode'}
            </button>
          )}
        </div>
      </div>

      {compareMode && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-xs text-indigo-300">
            Select 2 candidates to run a deep AI comparison. ({compareSelected.length}/2 selected)
          </p>
          <button
            disabled={compareSelected.length !== 2}
            onClick={() => setShowCompareModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors uppercase"
          >
            Run Comparison
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 flex flex-col min-h-0">
        {rankingError ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 flex gap-3.5 text-rose-400 text-xs items-start">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Ranking Computation Error</p>
              <p className="mt-1.5 text-slate-300 leading-relaxed">{rankingError}</p>
              <button
                onClick={onRetry}
                className="mt-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3.5 py-2 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all active:scale-95 shadow-sm"
              >
                Retry Ranking Query
              </button>
            </div>
          </div>
        ) : isRanking && candidates.length === 0 ? (
          <CandidateListSkeleton />
        ) : candidates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 text-xs text-center p-6 border border-dashed border-[#242435] rounded-2xl">
            <Users className="h-10 w-10 text-slate-500 mb-2" />
            <p className="font-semibold text-slate-300 text-sm">No Candidates Evaluated</p>
            <p className="text-slate-500 mt-1 max-w-xs leading-relaxed">
              Trigger a database seed by clicking the &quot;Reset &amp; Seed Data&quot; button or add
              candidate records using the backend endpoint.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <CandidateTable 
            candidates={candidates} 
            selectedCandidateId={selectedCandidateId} 
            onSelectCandidate={onSelectCandidate} 
          />
        ) : (
          candidates.map((cand) => (
            <div key={cand.id} className="relative group">
              <CandidateCard
                candidate={cand}
                isSelected={selectedCandidateId === cand.id}
                onViewResume={(e) => openResumeViewer(cand, e)}
                onClick={() => {
                  if (compareMode) {
                    toggleCompareSelection(cand, { stopPropagation: () => {} } as any);
                  } else {
                    onSelectCandidate(cand);
                  }
                }}
              />
              {compareMode && (
                <div 
                  className="absolute top-4 right-4 z-10 cursor-pointer"
                  onClick={(e) => toggleCompareSelection(cand, e)}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${compareSelected.find(c => c.id === cand.id) ? 'bg-indigo-600 border-indigo-500' : 'bg-[#0d0d16] border-[#3e3e57] group-hover:border-indigo-500/50'}`}>
                    {compareSelected.find(c => c.id === cand.id) && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCompareModal && compareSelected.length === 2 && (
        <CandidateComparisonModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          candidateA={compareSelected[0]}
          candidateB={compareSelected[1]}
          job={activeJob}
          apiToken={token}
        />
      )}

      {resumeViewer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[82vh] bg-[#101018] border border-[#2b2b3f] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#242435] flex items-center justify-between bg-[#14141d]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  Resume Viewer
                </div>
                <h3 className="text-sm font-bold text-white mt-1 truncate">{resumeViewer.candidateName}</h3>
              </div>
              <button
                type="button"
                title="Close resume viewer"
                onClick={() => setResumeViewer(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {resumeViewer.loading ? (
                <div className="flex items-center gap-2 text-xs text-indigo-300">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading resume...
                </div>
              ) : resumeViewer.error ? (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex gap-3 text-rose-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{resumeViewer.error}</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200 font-mono bg-[#0b0b12] border border-[#242435] rounded-xl p-4">
                  {resumeViewer.resumeText}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
