import React from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, FileQuestion, Users, RefreshCw, X } from 'lucide-react';
import type { Candidate } from '@/app/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useDecision } from '@/app/hooks/useDecision';

interface Props {
  candidate: Candidate;
  jobId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DecisionCenterPanel({ candidate, jobId, isOpen, onClose }: Props) {
  const { data, isLoading } = useDecision(jobId, candidate.id);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-[#09090c]/80">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0d0d16] border border-[#242435] shadow-[0_0_50px_rgba(99,102,241,0.15)] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-900/40 to-[#14141d] px-6 py-4 border-b border-[#242435] flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30 shadow-inner">
                <Sparkles className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">AI Decision Center</h2>
                <p className="text-xs text-indigo-300">Executive summary for {candidate.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white bg-[#1b1b2a] hover:bg-[#242435] p-2 rounded-full transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-indigo-400 space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p className="text-sm font-semibold animate-pulse">AI is synthesizing final decision matrix...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Why Selected */}
                <div className="bg-[#14141d] border border-emerald-500/20 rounded-xl p-5 shadow-[0_4px_20px_rgba(16,185,129,0.05)] hover:border-emerald-500/40 transition-colors">
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4" /> Why was this candidate selected?
                  </h3>
                  <ul className="space-y-2">
                    {data?.strengths?.map((strength, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{strength}</span>
                      </li>
                    )) || <li className="text-xs text-slate-500 italic">Strong match across required skill graphs and behavioral indicators.</li>}
                  </ul>
                </div>

                {/* Risks */}
                <div className="bg-[#14141d] border border-rose-500/20 rounded-xl p-5 shadow-[0_4px_20px_rgba(244,63,94,0.05)] hover:border-rose-500/40 transition-colors">
                  <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4" /> What are the risks?
                  </h3>
                  <ul className="space-y-2">
                    {data?.risks?.map((risk, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-rose-500 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    )) || <li className="text-xs text-emerald-500/80 italic">No critical risks identified.</li>}
                  </ul>
                </div>

                {/* Interview Plan */}
                <div className="md:col-span-2 bg-[#14141d] border border-indigo-500/20 rounded-xl p-5 shadow-[0_4px_20px_rgba(99,102,241,0.05)]">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2 mb-4 border-b border-[#242435] pb-2">
                    <FileQuestion className="h-4 w-4" /> Recommended Interview Strategy
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data?.interview_questions?.map((iq, i) => (
                      <div key={i} className="bg-[#0d0d16] border border-[#242435] p-3 rounded-lg relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 group-hover:bg-indigo-400 transition-colors"></div>
                        <p className="text-xs font-bold text-slate-200 mb-1">{iq.question}</p>
                        <p className="text-[10px] text-slate-400 italic">Target: {iq.rationale}</p>
                      </div>
                    )) || <p className="text-xs text-slate-500">Standard technical screening recommended.</p>}
                  </div>
                </div>

                {/* Role Fit & Success Prediction */}
                <div className="bg-[#14141d] border border-purple-500/20 rounded-xl p-5 shadow-[0_4px_20px_rgba(168,85,247,0.05)]">
                  <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4" /> Would they succeed in this role?
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    Based on their <span className="font-bold text-indigo-300">trajectory score of {Math.round(candidate.factors.trajectory * 100)}</span> and <span className="font-bold text-indigo-300">leadership impact of {Math.round(candidate.factors.success * 100)}</span>, this candidate has a high probability of integrating successfully. 
                  </p>
                  <div className="w-full bg-[#0d0d16] rounded-full h-2 border border-[#242435]">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.round(candidate.factors.success * 100)}%` }}></div>
                  </div>
                  <p className="text-[10px] text-right mt-1 text-slate-500 uppercase font-bold tracking-wider">Projected Success Probability</p>
                </div>

                {/* Alternative Recommendation */}
                <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4" /> Who should we hire instead?
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If this candidate does not pass behavioral screening, the model suggests evaluating candidates with higher <span className="text-amber-400 font-bold">Skill Adjacency</span> scores to fill the missing gap in: <span className="italic">{data?.risks?.[0] || 'domain-specific tools'}</span>.
                  </p>
                  <button className="mt-3 bg-[#1b1b2a] hover:bg-[#242435] border border-[#3e3e57] px-3 py-1.5 rounded-lg text-[10px] text-slate-300 font-bold uppercase w-full transition-colors">
                    Find Alternatives
                  </button>
                </div>

              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
