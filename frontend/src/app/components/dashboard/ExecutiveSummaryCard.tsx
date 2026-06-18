import React, { useState } from 'react';
import { Award, AlertTriangle, CheckCircle, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { DecisionCenterPanel } from '../candidates/DecisionCenterPanel';

export default function ExecutiveSummaryCard({ candidate, jobId }: { candidate: any, jobId: number }) {
  const [showDecisionCenter, setShowDecisionCenter] = useState(false);

  if (!candidate) return null;

  // Derive risk from missing skills
  const risks = candidate.explanation?.missing_skills?.critical_missing_skills || [];
  const strengths = candidate.explanation?.strengths || [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-indigo-900/40 via-[#14141d] to-[#14141d] border border-indigo-500/30 rounded-2xl p-5 mb-5 shadow-2xl relative overflow-hidden"
    >
      {/* Glassmorphism blur backdrop */}
      <div className="absolute inset-0 bg-[#09090c]/40 backdrop-blur-md -z-10"></div>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 relative">
        
        {/* Candidate Highlight */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="bg-indigo-600/20 p-3 rounded-xl border border-indigo-500/50">
              <Award className="h-8 w-8 text-indigo-400" />
            </div>
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse">
              #1
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Top Recommended Candidate</p>
            <h2 className="text-2xl font-black text-white">{candidate.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 border border-emerald-500/20">
                <TrendingUp className="h-3 w-3" /> {candidate.overall_score}% Match
              </span>
              <span className="text-xs text-slate-400">Confidence: {candidate.confidence_score}/100</span>
            </div>
          </div>
        </div>

        {/* Breakdown Panel */}
        <div className="flex flex-col sm:flex-row gap-6 bg-[#09090c]/60 p-3 rounded-xl border border-[#242435]">
          <div className="max-w-[200px]">
            <h4 className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1 mb-1">
              <CheckCircle className="h-3 w-3" /> Why Hire
            </h4>
            <ul className="text-xs text-slate-300 space-y-1">
              {strengths.slice(0, 2).map((s: string, i: number) => (
                <li key={i} className="truncate" title={s}>• {s}</li>
              ))}
              {strengths.length === 0 && <li>• Strong multi-factor alignment</li>}
            </ul>
          </div>

          <div className="w-px bg-[#242435] hidden sm:block"></div>

          <div className="max-w-[200px]">
            <h4 className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3" /> Key Risks
            </h4>
            <ul className="text-xs text-slate-300 space-y-1">
              {risks.slice(0, 2).map((r: string, i: number) => (
                <li key={i} className="truncate text-rose-200/80" title={r}>• Missing: {r}</li>
              ))}
              {risks.length === 0 && <li className="text-emerald-400/80">• No critical gaps found</li>}
            </ul>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button 
            onClick={() => setShowDecisionCenter(true)}
            className="bg-white hover:bg-slate-200 text-black px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            Decision Center
          </button>
        </div>

      </div>

      <DecisionCenterPanel 
        candidate={candidate} 
        jobId={jobId} 
        isOpen={showDecisionCenter} 
        onClose={() => setShowDecisionCenter(false)} 
      />
    </motion.div>
  );
}
