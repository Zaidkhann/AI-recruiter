"use client";

import React, { useEffect, useState } from "react";
import { 
  Upload, 
  FileText, 
  Search, 
  Database, 
  GitBranch, 
  Link2, 
  Share2, 
  Brain, 
  Cpu, 
  CheckCircle,
  Play,
  RotateCcw,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PipelineEvent {
  stage: string;
  label: string;
  status: "pending" | "processing" | "complete" | "error";
  timestamp: number;
  duration_ms: number;
  details?: Record<string, any>;
  stage_index: number;
  total_stages: number;
}

const STAGE_CONFIGS: Record<string, { icon: React.ReactNode; color: string; desc: string }> = {
  resume_uploaded: { icon: <Upload className="w-4 h-4" />, color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10", desc: "Binary validation and Magic Numbers header check." },
  ai_parsing: { icon: <FileText className="w-4 h-4" />, color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10", desc: "Structured parsing of contact details, education, and career history." },
  skill_extraction: { icon: <Search className="w-4 h-4" />, color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10", desc: "Parsing natural language skill keywords." },
  embedding_generation: { icon: <Database className="w-4 h-4" />, color: "text-purple-400 border-purple-500/30 bg-purple-500/10", desc: "Generating 768-dimension dense vectors for search alignment." },
  github_analysis: { icon: <GitBranch className="w-4 h-4" />, color: "text-pink-400 border-pink-500/30 bg-pink-500/10", desc: "Enriching with public repositories, commit volumes, and contribution rates." },
  linkedin_intelligence: { icon: <Link2 className="w-4 h-4" />, color: "text-blue-400 border-blue-500/30 bg-blue-500/10", desc: "Synthesizing career velocity, progression rates, and seniority levels." },
  knowledge_graph_mapping: { icon: <Share2 className="w-4 h-4" />, color: "text-teal-400 border-teal-500/30 bg-teal-500/10", desc: "Adding nodes and weights to twin knowledge graphs." },
  behavioral_intelligence: { icon: <Brain className="w-4 h-4" />, color: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10", desc: "Constructing developer personas and peak coding hour mappings." },
  ranking_engine: { icon: <Cpu className="w-4 h-4" />, color: "text-rose-400 border-rose-500/30 bg-rose-500/10", desc: "Evaluating multi-factor scores, weights, and team gap boosters." },
  decision_generated: { icon: <CheckCircle className="w-4 h-4" />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", desc: "Compiling hire consensus and committee question prompts." },
};

interface PipelineStoryProps {
  sessionId?: string;
  onComplete?: () => void;
}

export function PipelineStory({ sessionId, onComplete }: PipelineStoryProps) {
  const [events, setEvents] = useState<Record<string, PipelineEvent>>({});
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  
  // List of stages in order
  const stages = [
    "resume_uploaded",
    "ai_parsing",
    "skill_extraction",
    "embedding_generation",
    "github_analysis",
    "linkedin_intelligence",
    "knowledge_graph_mapping",
    "behavioral_intelligence",
    "ranking_engine",
    "decision_generated"
  ];

  useEffect(() => {
    if (!sessionId) return;

    setStatus("processing");
    setErrorDetail(null);
    setEvents({});

    // SSE connection
    const eventSource = new EventSource(`http://localhost:8000/api/intelligence/pipeline-events/${sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const data: PipelineEvent = JSON.parse(event.data);
        
        setEvents((prev) => ({
          ...prev,
          [data.stage]: data,
        }));
        
        setCurrentStage(data.stage);
        
        if (data.status === "error") {
          setStatus("error");
          setErrorDetail(data.details?.reason || "An error occurred during pipeline execution.");
          eventSource.close();
        } else if (data.stage === "decision_generated" && data.status === "complete") {
          setStatus("complete");
          eventSource.close();
          if (onComplete) onComplete();
        }
      } catch (err) {
        console.error("Failed to parse SSE event data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE EventSource error:", err);
      setStatus("error");
      setErrorDetail("Lost connection to real-time pipeline telemetry.");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  const getStageStatus = (stage: string) => {
    const ev = events[stage];
    if (ev) return ev.status;
    
    // If we're processing and this stage is after the current one, it's pending
    if (status === "processing" || status === "idle") {
      const currentIdx = currentStage ? stages.indexOf(currentStage) : -1;
      const targetIdx = stages.indexOf(stage);
      if (targetIdx <= currentIdx) return "processing"; // fallback in case event was lost
      return "pending";
    }
    
    if (status === "complete") return "complete";
    return "pending";
  };

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-xl backdrop-blur-md max-w-lg w-full flex flex-col gap-4">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-[#242435] pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-400 animate-spin" />
            Ingestion Pipeline Visualizer
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Real-time resume telemetry stream</p>
        </div>

        {status === "processing" && (
          <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            STREAMING
          </span>
        )}
        {status === "complete" && (
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            INGESTED
          </span>
        )}
        {status === "error" && (
          <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            FAILED
          </span>
        )}
        {status === "idle" && (
          <span className="text-[10px] text-slate-400 font-bold bg-slate-500/10 px-2 py-0.5 rounded border border-slate-500/20">
            IDLE
          </span>
        )}
      </div>

      {status === "error" && errorDetail && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorDetail}</span>
        </div>
      )}

      {/* Vertical Timeline */}
      <div className="relative pl-6 space-y-4 border-l-2 border-[#242435] ml-3 py-2">
        {stages.map((stage) => {
          const config = STAGE_CONFIGS[stage];
          const stageStatus = getStageStatus(stage);
          const event = events[stage];
          
          let iconBg = "bg-slate-800 text-slate-500 border-slate-700";
          if (stageStatus === "complete") iconBg = "bg-emerald-500 text-white border-emerald-400";
          else if (stageStatus === "processing") iconBg = "bg-indigo-600 text-white border-indigo-400 animate-pulse";
          else if (stageStatus === "error") iconBg = "bg-red-500 text-white border-red-400";

          return (
            <div key={stage} className="relative group">
              {/* Timeline dot */}
              <div 
                className={`absolute -left-[35px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border text-xs z-10 transition-colors duration-300 ${iconBg}`}
              >
                {stageStatus === "complete" ? <CheckCircle className="w-3.5 h-3.5" /> : config.icon}
              </div>

              {/* Card content */}
              <div 
                className={`p-3 border rounded-lg transition-all duration-300 ${
                  stageStatus === "processing" 
                    ? "bg-[#1b1b29] border-indigo-500/40 shadow-md shadow-indigo-500/5" 
                    : stageStatus === "complete"
                      ? "bg-[#14141d]/80 border-[#2c2c3e]"
                      : "bg-[#14141d]/30 border-transparent text-slate-500"
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <h5 className={`text-xs font-bold ${stageStatus === "processing" ? "text-indigo-400" : stageStatus === "complete" ? "text-slate-200" : "text-slate-500"}`}>
                    {config.desc.substring(0, 1) + stage.replace(/_/g, " ").substring(1)}
                  </h5>
                  {event && event.duration_ms > 0 && (
                    <span className="text-[9px] font-mono text-slate-400">{event.duration_ms}ms</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {config.desc}
                </p>

                {/* Details toggle panel */}
                <AnimatePresence>
                  {event && event.details && Object.keys(event.details).length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-2 pt-2 border-t border-[#242435]/40 text-[9px] font-mono text-slate-400"
                    >
                      <div className="bg-[#0b0b12] p-1.5 rounded border border-[#242435]/20 max-h-24 overflow-y-auto">
                        {Object.entries(event.details).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2">
                            <span className="text-slate-500">{k}:</span>
                            <span className="text-indigo-300 text-right truncate max-w-[150px]">{JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
