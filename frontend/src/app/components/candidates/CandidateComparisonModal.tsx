import React, { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, TrendingUp, RefreshCw, Layers, ShieldAlert, GitCommit, UserCheck, Star } from "lucide-react";
import type { Candidate, Job } from "@/app/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  candidateA: Candidate;
  candidateB: Candidate;
  job: Job;
}

export function CandidateComparisonModal({ isOpen, onClose, candidateA, candidateB, job }: Props) {
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && candidateA && candidateB && job) {
      fetchComparison();
    }
  }, [isOpen, candidateA, candidateB, job]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const getAPIUrl = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const url = `${getAPIUrl()}/api/rank/compare?job_id=${job.id}&candidate_a=${candidateA.id}&candidate_b=${candidateB.id}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComparisonData(data);
      }
    } catch (e) {
      console.error("Failed to fetch comparison", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const reqSkills = job.graph_schema?.skills_required || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#0d0d16] border border-[#242435] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden relative"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#242435] bg-[#14141d] flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
                <Layers className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI Candidate Comparison</h2>
                <p className="text-xs text-slate-400">Deep evaluation against {job.title} requirements</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#242435] rounded-full text-slate-400 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading || !comparisonData ? (
              <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
                <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                <p className="text-sm font-semibold animate-pulse">Running Deep Comparison Analysis...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                
                {/* Column 1: Candidate A */}
                <div className={`flex flex-col border rounded-xl p-5 ${comparisonData.winner === 'A' ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-[#14141d] border-[#242435]'}`}>
                  <div className="text-center mb-6">
                    {comparisonData.winner === 'A' && (
                      <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Recommended</span>
                    )}
                    <h3 className="text-xl font-bold text-white">{candidateA.name}</h3>
                    <div className="text-3xl font-black text-indigo-400 mt-2">{Math.round(candidateA.final_score * 100)}%</div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Overall Match</p>
                  </div>

                  <div className="space-y-4">
                    <ScoreBar label="Leadership Score" score={candidateA.factors.success * 100} icon={<Star className="h-3 w-3"/>} />
                    <ScoreBar label="GitHub Intelligence" score={candidateA.factors.behavioral * 100} icon={<GitCommit className="h-3 w-3"/>} />
                    <ScoreBar label="Behavioral Fit" score={candidateA.factors.semantic * 100} icon={<UserCheck className="h-3 w-3"/>} />
                  </div>

                  <div className="mt-6 border-t border-[#242435] pt-4">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Matching Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {reqSkills.filter(s => candidateA.skills.includes(s)).map((s, i) => (
                        <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Critical Missing</h4>
                    <div className="flex flex-wrap gap-1">
                      {reqSkills.filter(s => !candidateA.skills.includes(s)).map((s, i) => (
                        <span key={i} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">{s}</span>
                      ))}
                      {reqSkills.filter(s => !candidateA.skills.includes(s)).length === 0 && (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Job Requirements (Middle) */}
                <div className="flex flex-col bg-[#11111b] border border-[#242435] rounded-xl p-5 opacity-90 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#11111b] via-transparent to-[#11111b] pointer-events-none z-0"></div>
                  
                  <div className="text-center mb-6 z-10">
                    <div className="mx-auto bg-slate-800 p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-2">
                      <ShieldAlert className="h-5 w-5 text-slate-300" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">Baseline Requirement</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{job.title}</p>
                  </div>

                  <div className="space-y-4 z-10 flex-1 flex flex-col justify-center">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Required Skills Target</p>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {reqSkills.slice(0, 8).map((s, i) => (
                          <span key={i} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[#242435] pt-4 text-center z-10">
                    <h4 className="text-[10px] uppercase font-bold text-indigo-400 mb-1">AI Verdict</h4>
                    <p className="text-sm font-bold text-white">{comparisonData.differentiators?.[0] || "Close match"}</p>
                  </div>
                </div>

                {/* Column 3: Candidate B */}
                <div className={`flex flex-col border rounded-xl p-5 ${comparisonData.winner === 'B' ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-[#14141d] border-[#242435]'}`}>
                  <div className="text-center mb-6">
                    {comparisonData.winner === 'B' && (
                      <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Recommended</span>
                    )}
                    <h3 className="text-xl font-bold text-white">{candidateB.name}</h3>
                    <div className="text-3xl font-black text-indigo-400 mt-2">{Math.round(candidateB.final_score * 100)}%</div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Overall Match</p>
                  </div>

                  <div className="space-y-4">
                    <ScoreBar label="Leadership Score" score={candidateB.factors.success * 100} icon={<Star className="h-3 w-3"/>} />
                    <ScoreBar label="GitHub Intelligence" score={candidateB.factors.behavioral * 100} icon={<GitCommit className="h-3 w-3"/>} />
                    <ScoreBar label="Behavioral Fit" score={candidateB.factors.semantic * 100} icon={<UserCheck className="h-3 w-3"/>} />
                  </div>

                  <div className="mt-6 border-t border-[#242435] pt-4">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Matching Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {reqSkills.filter(s => candidateB.skills.includes(s)).map((s, i) => (
                        <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Critical Missing</h4>
                    <div className="flex flex-wrap gap-1">
                      {reqSkills.filter(s => !candidateB.skills.includes(s)).map((s, i) => (
                        <span key={i} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">{s}</span>
                      ))}
                      {reqSkills.filter(s => !candidateB.skills.includes(s)).length === 0 && (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ScoreBar({ label, score, icon }: { label: string, score: number, icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between items-center text-[10px] mb-1">
        <span className="text-slate-300 font-semibold flex items-center gap-1">{icon} {label}</span>
        <span className="text-white font-bold">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full bg-[#09090c] rounded-full overflow-hidden border border-[#242435]">
        <div 
          className="h-full bg-indigo-500 rounded-full" 
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        ></div>
      </div>
    </div>
  );
}
