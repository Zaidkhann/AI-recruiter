"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Search,
  MessageSquare,
  Gift,
  CheckCircle,
  XCircle,
  ChevronRight,
  Plus,
  RefreshCw,
  Users,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  FileSearch,
} from "lucide-react";

interface ATSRecord {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  job_id: number;
  job_title: string;
  stage: string;
  notes: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ATSSummary {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
  rejected: number;
  total: number;
}

interface ATSScoreResult {
  candidate_id: number;
  job_id: number;
  ats_score: number;
  verdict: string;
  verdict_color: string;
  breakdown: {
    skills_match: number;
    keyword_density: number;
    experience_relevance: number;
    certification_bonus: number;
  };
  matched_skills: string[];
  missing_skills: string[];
  total_required_skills: number;
}

interface Props {
  selectedJobId: number | null;
  candidates: { id: number; name: string; email: string }[];
  getAPIUrl: () => string;
}

const STAGES = [
  { key: "applied", label: "Applied", icon: ClipboardList, color: "slate", gradient: "from-slate-500/20 to-slate-600/10" },
  { key: "screening", label: "Screening", icon: Search, color: "blue", gradient: "from-blue-500/20 to-blue-600/10" },
  { key: "interview", label: "Interview", icon: MessageSquare, color: "purple", gradient: "from-purple-500/20 to-purple-600/10" },
  { key: "offer", label: "Offer", icon: Gift, color: "amber", gradient: "from-amber-500/20 to-amber-600/10" },
  { key: "hired", label: "Hired", icon: CheckCircle, color: "emerald", gradient: "from-emerald-500/20 to-emerald-600/10" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "rose", gradient: "from-rose-500/20 to-rose-600/10" },
] as const;

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  applied: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/30", dot: "bg-slate-400" },
  screening: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/30", dot: "bg-blue-400" },
  interview: { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30", dot: "bg-purple-400" },
  offer: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30", dot: "bg-amber-400" },
  hired: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  rejected: { bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/30", dot: "bg-rose-400" },
};

/* ---- Score Ring SVG ---- */
function ScoreRing({ score, size = 48, stroke = 4 }: { score: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#242435"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

/* ---- Verdict Badge ---- */
function VerdictBadge({ verdict, color }: { verdict: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };
  const iconMap: Record<string, React.ReactNode> = {
    emerald: <Shield className="h-2.5 w-2.5" />,
    blue: <TrendingUp className="h-2.5 w-2.5" />,
    amber: <AlertTriangle className="h-2.5 w-2.5" />,
    rose: <XCircle className="h-2.5 w-2.5" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${colorMap[color] || colorMap.blue}`}>
      {iconMap[color]}
      {verdict}
    </span>
  );
}

export default function ATSBoard({ selectedJobId, candidates, getAPIUrl }: Props) {
  const [records, setRecords] = useState<ATSRecord[]>([]);
  const [summary, setSummary] = useState<ATSSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCandidateId, setAddCandidateId] = useState<number | "">(""); 
  const [addNotes, setAddNotes] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // ATS Score Scanner state
  const [scores, setScores] = useState<Record<string, ATSScoreResult>>({});
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [expandedScoreId, setExpandedScoreId] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [batchScanning, setBatchScanning] = useState(false);

  const fetchATS = useCallback(async () => {
    setLoading(true);
    try {
      const jobQuery = selectedJobId !== null ? `?job_id=${selectedJobId}` : "";
      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`${getAPIUrl()}/api/ats${jobQuery}`),
        fetch(`${getAPIUrl()}/api/ats/summary${jobQuery}`),
      ]);
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [selectedJobId, getAPIUrl]);

  useEffect(() => {
    fetchATS();
  }, [selectedJobId, fetchATS]);

  const moveToStage = async (recordId: number, newStage: string) => {
    setMovingId(recordId);
    try {
      const res = await fetch(`${getAPIUrl()}/api/ats/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) await fetchATS();
    } catch {
      /* silently fail */
    } finally {
      setMovingId(null);
    }
  };

  const addRecord = async () => {
    if (!addCandidateId || selectedJobId === null) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${getAPIUrl()}/api/ats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: addCandidateId,
          job_id: selectedJobId,
          stage: "applied",
          notes: addNotes || null,
        }),
      });
      if (res.ok) {
        await fetchATS();
        setShowAddModal(false);
        setAddCandidateId("");
        setAddNotes("");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to add candidate to ATS");
      }
    } catch {
      alert("Could not reach ATS API");
    } finally {
      setAddLoading(false);
    }
  };

  // ---- ATS Score Scanner Functions ----
  const fetchScore = async (candidateId: number) => {
    if (selectedJobId === null) return;
    const key = `${candidateId}-${selectedJobId}`;
    if (scores[key]) {
      setExpandedScoreId(expandedScoreId === candidateId ? null : candidateId);
      return;
    }
    setScanningId(candidateId);
    try {
      const res = await fetch(
        `${getAPIUrl()}/api/ats/score/${candidateId}/${selectedJobId}`,
      );
      if (res.ok) {
        const data: ATSScoreResult = await res.json();
        setScores((prev) => ({ ...prev, [key]: data }));
        setExpandedScoreId(candidateId);
      }
    } catch {
      /* silently fail */
    } finally {
      setScanningId(null);
    }
  };

  const batchScanAll = async () => {
    if (selectedJobId === null || records.length === 0) return;
    setBatchScanning(true);
    const uniqueCandidates = [...new Set(records.map((r) => r.candidate_id))];
    for (const cid of uniqueCandidates) {
      const key = `${cid}-${selectedJobId}`;
      if (scores[key]) continue;
      try {
        const res = await fetch(
          `${getAPIUrl()}/api/ats/score/${cid}/${selectedJobId}`,
        );
        if (res.ok) {
          const data: ATSScoreResult = await res.json();
          setScores((prev) => ({ ...prev, [key]: data }));
        }
      } catch {
        /* continue */
      }
    }
    setBatchScanning(false);
  };

  const getStageRecords = (stage: string) => records.filter((r) => r.stage === stage);

  // Candidates not yet tracked in ATS for this job
  const trackedCandidateIds = new Set(records.map((r) => r.candidate_id));
  const untracked = candidates.filter((c) => !trackedCandidateIds.has(c.id));

  const getNextStage = (current: string): string | null => {
    const order = ["applied", "screening", "interview", "offer", "hired"];
    const idx = order.indexOf(current);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getCachedScore = (candidateId: number): ATSScoreResult | null => {
    if (selectedJobId === null) return null;
    return scores[`${candidateId}-${selectedJobId}`] || null;
  };

  return (
    <div className="space-y-5">
      {/* Pipeline Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {STAGES.map((s) => {
          const count = summary ? (summary as any)[s.key] ?? 0 : 0;
          const Icon = s.icon;
          const colors = STAGE_COLORS[s.key];
          return (
            <div
              key={s.key}
              className={`bg-gradient-to-br ${s.gradient} border ${colors.border} rounded-xl p-3.5 flex flex-col items-center text-center transition-all hover:scale-[1.03] hover:shadow-lg`}
            >
              <div className={`p-2 rounded-lg ${colors.bg} mb-2`}>
                <Icon className={`h-4.5 w-4.5 ${colors.text}`} />
              </div>
              <span className="text-xl font-extrabold text-white">{count}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text} mt-0.5`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ---- ATS RESUME SCORE SCANNER ---- */}
      <div className="bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowScanner(!showScanner)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-indigo-500/5 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <FileSearch className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                ATS Resume Score Scanner
                <span className="text-[9px] bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/25 font-bold uppercase tracking-wider">
                  New
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Scan resumes against job description for keyword match scoring
              </p>
            </div>
          </div>
          {showScanner ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showScanner && (
          <div className="px-5 pb-5 space-y-4 animate-fade-in">
            {/* Scanner Controls */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400">
                Click <strong className="text-indigo-400">Scan</strong> on any candidate card below, or batch scan all tracked candidates.
              </p>
              <button
                onClick={batchScanAll}
                disabled={batchScanning || records.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-[10px] font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchScanning ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {batchScanning ? "Scanning..." : "Batch Scan All"}
              </button>
            </div>

            {/* Scanned Results Grid */}
            {Object.keys(scores).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {records
                  .filter((r) => getCachedScore(r.candidate_id) !== null)
                  .filter((r, idx, arr) => arr.findIndex((x) => x.candidate_id === r.candidate_id) === idx)
                  .sort((a, b) => (getCachedScore(b.candidate_id)?.ats_score ?? 0) - (getCachedScore(a.candidate_id)?.ats_score ?? 0))
                  .map((rec) => {
                    const sc = getCachedScore(rec.candidate_id)!;
                    const isExpanded = expandedScoreId === rec.candidate_id;
                    return (
                      <div
                        key={`score-${rec.candidate_id}`}
                        className="bg-[#14141d]/80 backdrop-blur-sm border border-[#242435] rounded-xl overflow-hidden hover:border-indigo-500/30 transition-all"
                      >
                        {/* Card Header */}
                        <div className="p-3.5 flex items-center gap-3">
                          <div className="relative shrink-0">
                            <ScoreRing score={sc.ats_score} size={46} stroke={3.5} />
                            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-white">
                              {Math.round(sc.ats_score)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-slate-200 truncate">
                              {rec.candidate_name}
                            </p>
                            <VerdictBadge verdict={sc.verdict} color={sc.verdict_color} />
                          </div>
                          <button
                            onClick={() =>
                              setExpandedScoreId(isExpanded ? null : rec.candidate_id)
                            }
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Expanded Breakdown */}
                        {isExpanded && (
                          <div className="border-t border-[#242435] p-3.5 space-y-3 animate-fade-in">
                            {/* Score Bars */}
                            <div className="space-y-2">
                              {[
                                { label: "Skills Match", value: sc.breakdown.skills_match, color: "bg-indigo-500", icon: <Target className="h-2.5 w-2.5" /> },
                                { label: "Keyword Density", value: sc.breakdown.keyword_density, color: "bg-purple-500", icon: <Search className="h-2.5 w-2.5" /> },
                                { label: "Experience", value: sc.breakdown.experience_relevance, color: "bg-blue-500", icon: <TrendingUp className="h-2.5 w-2.5" /> },
                                { label: "Certifications", value: sc.breakdown.certification_bonus, color: "bg-emerald-500", icon: <Shield className="h-2.5 w-2.5" /> },
                              ].map((bar) => (
                                <div key={bar.label}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                                      {bar.icon} {bar.label}
                                    </span>
                                    <span className="text-[9px] text-white font-bold">
                                      {bar.value}%
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-[#242435] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${bar.color} rounded-full transition-all duration-700 ease-out`}
                                      style={{ width: `${bar.value}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Skills Tags */}
                            {(sc.matched_skills.length > 0 || sc.missing_skills.length > 0) && (
                              <div className="space-y-2">
                                {sc.matched_skills.length > 0 && (
                                  <div>
                                    <p className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
                                      ✓ Matched ({sc.matched_skills.length}/{sc.total_required_skills})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {sc.matched_skills.map((s) => (
                                        <span
                                          key={s}
                                          className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-semibold capitalize"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {sc.missing_skills.length > 0 && (
                                  <div>
                                    <p className="text-[8px] text-rose-400 font-bold uppercase tracking-wider mb-1">
                                      ✗ Missing ({sc.missing_skills.length}/{sc.total_required_skills})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {sc.missing_skills.map((s) => (
                                        <span
                                          key={s}
                                          className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-md font-semibold capitalize"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            ATS Pipeline Tracker
          </h3>
          <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/25 font-bold">
            {records.length} tracked
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchATS()}
            disabled={loading}
            className="p-2 rounded-lg bg-[#1b1b2a] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {untracked.length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Pipeline
            </button>
          )}
        </div>
      </div>

      {/* Pipeline Kanban Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAGES.filter((s) => s.key !== "rejected").map((s) => {
          const stageRecords = getStageRecords(s.key);
          const colors = STAGE_COLORS[s.key];
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className={`bg-[#0d0d16]/60 border ${colors.border} rounded-xl overflow-hidden flex flex-col`}
            >
              {/* Lane Header */}
              <div className={`px-3 py-2.5 border-b ${colors.border} flex items-center justify-between bg-gradient-to-r ${s.gradient}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
                    {s.label}
                  </span>
                </div>
                <span className={`text-[10px] font-extrabold ${colors.text} bg-black/20 px-1.5 py-0.5 rounded-md`}>
                  {stageRecords.length}
                </span>
              </div>

              {/* Lane Cards */}
              <div className="p-2 space-y-2 flex-1 min-h-[80px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {stageRecords.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[10px] text-slate-600 py-6">
                    No candidates
                  </div>
                ) : (
                  stageRecords.map((rec) => {
                    const nextStage = getNextStage(rec.stage);
                    const isMov = movingId === rec.id;
                    const cachedScore = getCachedScore(rec.candidate_id);
                    const isScanning = scanningId === rec.candidate_id;
                    return (
                      <div
                        key={rec.id}
                        className="bg-[#14141d] border border-[#242435] rounded-lg p-2.5 space-y-1.5 hover:border-indigo-500/30 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-200 truncate">
                              {rec.candidate_name}
                            </p>
                            <p className="text-[9px] text-slate-500 truncate">{rec.candidate_email}</p>
                          </div>
                          {/* Inline ATS Score Badge */}
                          {cachedScore ? (
                            <div className="shrink-0 flex items-center gap-1">
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                  cachedScore.ats_score >= 80
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : cachedScore.ats_score >= 60
                                    ? "bg-blue-500/15 text-blue-400"
                                    : cachedScore.ats_score >= 40
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-rose-500/15 text-rose-400"
                                }`}
                              >
                                {Math.round(cachedScore.ats_score)}%
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => fetchScore(rec.candidate_id)}
                              disabled={isScanning}
                              className="shrink-0 p-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 opacity-0 group-hover:opacity-100"
                              title="Scan ATS Score"
                            >
                              {isScanning ? (
                                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <FileSearch className="h-2.5 w-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {rec.notes && (
                          <p className="text-[9px] text-slate-500 line-clamp-2 leading-relaxed italic">
                            {rec.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          {nextStage && (
                            <button
                              onClick={() => moveToStage(rec.id, nextStage)}
                              disabled={isMov}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all active:scale-95 disabled:opacity-50 ${
                                STAGE_COLORS[nextStage].bg
                              } ${STAGE_COLORS[nextStage].text} border ${STAGE_COLORS[nextStage].border} hover:brightness-125`}
                            >
                              {isMov ? (
                                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <ChevronRight className="h-2.5 w-2.5" />
                              )}
                              {STAGES.find((st) => st.key === nextStage)?.label}
                            </button>
                          )}
                          <button
                            onClick={() => moveToStage(rec.id, "rejected")}
                            disabled={isMov || rec.stage === "hired"}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 transition-all active:scale-95 hover:brightness-125 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <XCircle className="h-2.5 w-2.5" />
                            Reject
                          </button>
                        </div>
                        {rec.updated_by && (
                          <p className="text-[8px] text-slate-600 pt-0.5">
                            by {rec.updated_by}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rejected Lane (separate) */}
      {getStageRecords("rejected").length > 0 && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-rose-500/20 flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Rejected
            </span>
            <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded-md ml-auto">
              {getStageRecords("rejected").length}
            </span>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {getStageRecords("rejected").map((rec) => (
              <div
                key={rec.id}
                className="bg-[#14141d] border border-[#242435] rounded-lg p-2.5 flex items-center gap-2"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-300 truncate">{rec.candidate_name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{rec.candidate_email}</p>
                </div>
                <button
                  onClick={() => moveToStage(rec.id, "applied")}
                  disabled={movingId === rec.id}
                  className="ml-auto shrink-0 text-[9px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 px-2 py-1 rounded-md transition-all active:scale-95 disabled:opacity-50"
                >
                  Reconsider
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to Pipeline Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#14141d] border border-[#242435] rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-2xl" />
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" />
              Add Candidate to ATS Pipeline
            </h3>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Select Candidate
              </label>
              <select
                value={addCandidateId}
                onChange={(e) => setAddCandidateId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-slate-100"
              >
                <option value="">— Choose a candidate —</option>
                {untracked.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#14141d]">
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Notes (optional)
              </label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Quick note about this candidate..."
                rows={2}
                className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-3 py-2 rounded-xl text-xs text-slate-100 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddCandidateId("");
                  setAddNotes("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-[#1b1b2a] hover:bg-slate-800 border border-slate-700 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={addRecord}
                disabled={!addCandidateId || addLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {addLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add to Applied
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
