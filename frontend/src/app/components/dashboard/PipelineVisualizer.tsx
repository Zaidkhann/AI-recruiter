"use client";

import React, { useState, useEffect } from 'react';
import { Upload, FileText, GitBranch, Link2, Database, Search, Cpu, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const PIPELINE_STEPS = [
  { id: 'upload', icon: <Upload className="h-4 w-4" />, label: 'Resume Upload' },
  { id: 'parse', icon: <FileText className="h-4 w-4" />, label: 'AI Parsing' },
  { id: 'github', icon: <GitBranch className="h-4 w-4" />, label: 'GitHub Analysis' },
  { id: 'linkedin', icon: <Link2 className="h-4 w-4" />, label: 'LinkedIn Enrich' },
  { id: 'embed', icon: <Database className="h-4 w-4" />, label: 'Vectorization' },
  { id: 'search', icon: <Search className="h-4 w-4" />, label: 'Semantic Search' },
  { id: 'rank', icon: <Cpu className="h-4 w-4" />, label: 'LLM Re-ranking' },
  { id: 'score', icon: <CheckCircle className="h-4 w-4" />, label: 'Final Score' }
];

export function PipelineVisualizer() {
  const [activeStep, setActiveStep] = useState(-1);

  // Animate the pipeline continuously for demo purposes
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev >= PIPELINE_STEPS.length - 1 ? -1 : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 shadow-md w-full overflow-hidden relative">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-indigo-400" /> Live AI Pipeline Telemetry
      </h3>
      
      <div className="flex items-center justify-between relative px-2">
        {/* Connecting Line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-[#242435] z-0"></div>
        <div 
          className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${Math.max(0, (activeStep / (PIPELINE_STEPS.length - 1)) * 100)}%` }}
        ></div>

        {PIPELINE_STEPS.map((step, idx) => {
          const isActive = idx === activeStep;
          const isPast = idx < activeStep;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 group">
              <motion.div 
                animate={{
                  scale: isActive ? 1.2 : 1,
                  boxShadow: isActive ? "0 0 15px rgba(99,102,241,0.5)" : "none"
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border-2 ${
                  isActive 
                    ? 'bg-indigo-600 border-indigo-400 text-white' 
                    : isPast 
                      ? 'bg-[#1b1b2a] border-emerald-500/50 text-emerald-400' 
                      : 'bg-[#0d0d16] border-[#3e3e57] text-slate-500'
                }`}
              >
                {step.icon}
              </motion.div>
              
              <div className="absolute -bottom-6 w-max text-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                {isActive && (
                  <div className="text-[8px] text-slate-400 font-mono mt-0.5 animate-pulse">
                    {Date.now() + idx * 100}ms
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
