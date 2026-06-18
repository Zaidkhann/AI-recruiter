"use client";

import React, { memo, useMemo } from "react";
import { Sparkles, AlertCircle, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { useDecision } from "@/app/hooks/useDecision";
import { Skeleton } from "@/app/components/shared/SkeletonLoader";
import { ExplanationCard } from "../ExplanationCard";
import type { DebateTurn } from "@/app/lib/types";

interface Props {
  jobId: number;
  candidateId: number;
  candidateExplanation?: any;
}

export const CommitteeReviewTab = memo(function CommitteeReviewTab({ jobId, candidateId, candidateExplanation }: Props) {
  const { data, isLoading, error } = useDecision(jobId, candidateId);

  return (
    <div className="space-y-6">
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
        <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Autonomous Hiring Debate
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Three specialized AI agents convene to debate this candidate&apos;s fit relative to the
            team&apos;s graph gaps and target job role parameters.
          </p>
        </div>
      </div>

      {/* Render Explanation Card */}
      {candidateExplanation && (
        <ExplanationCard explanation={candidateExplanation} />
      )}

      {isLoading ? (
        <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
          Committee agents are reviewing work history &amp; GitHub commits...
        </div>
      ) : error ? (
        <UnavailableNotice />
      ) : data?.debate && Array.isArray(data.debate) ? (
        <div className="space-y-6">
          <CommitteeVerdict debate={data.debate} />
          
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#242435] before:to-transparent">
          {data.debate.map((turn: DebateTurn, i: number) => {
            const isTL = turn.speaker === "Tech Lead" || turn.speaker.includes("Engineer");
            const isPM = turn.speaker === "Product Manager" || turn.speaker.includes("Product");
            return (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group animate-fade-in z-10">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#0d0d16] shrink-0 md:order-1 md:group-odd:-ml-5 md:group-even:-mr-5 shadow-xl z-20 text-xs font-bold bg-[#1b1b2a] text-slate-300">
                  {turn.speaker[0]}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#14141d] border border-[#242435] rounded-xl p-4 shadow-lg hover:border-indigo-500/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 justify-between">
                      <span className={`text-xs font-bold ${isTL ? 'text-blue-400' : isPM ? 'text-amber-400' : 'text-purple-400'}`}>{turn.speaker}</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full uppercase border ${
                          turn.tone === "enthusiastic"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : turn.tone === "skeptical"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {turn.tone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-2">{turn.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <UnavailableNotice />
      )}
    </div>
  );
});

function UnavailableNotice() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-400 text-xs font-semibold">
      <AlertCircle className="h-5 w-5 shrink-0" />
      Hiring committee debate is unavailable because the LLM service is offline or Gemini API Key
      is missing.
    </div>
  );
}

/**
 * CommitteeVerdict - Deterministic vote derivation from actual debate data.
 * 
 * Votes are computed by:
 * 1. Extracting unique speakers from the real debate turns.
 * 2. Counting each speaker's enthusiastic/analytical vs. skeptical turns.
 * 3. A speaker votes HIRE if they have more enthusiastic/analytical turns than skeptical ones.
 * 
 * No Math.random(), no hardcoded agent lists, no fake data.
 */
function CommitteeVerdict({ debate }: { debate: DebateTurn[] }) {
  const votes = useMemo(() => {
    // Group debate turns by speaker
    const speakerToneMap = new Map<string, { enthusiastic: number; skeptical: number; analytical: number }>();
    
    for (const turn of debate) {
      if (!speakerToneMap.has(turn.speaker)) {
        speakerToneMap.set(turn.speaker, { enthusiastic: 0, skeptical: 0, analytical: 0 });
      }
      const counts = speakerToneMap.get(turn.speaker)!;
      if (turn.tone === "enthusiastic") counts.enthusiastic++;
      else if (turn.tone === "skeptical") counts.skeptical++;
      else counts.analytical++;
    }

    // Derive each speaker's vote deterministically
    let hireCount = 0;
    let noHireCount = 0;

    const calculatedVotes = Array.from(speakerToneMap.entries()).map(([speaker, counts]) => {
      // A speaker leans HIRE if their enthusiastic+analytical turns outweigh skeptical turns
      const positiveSignal = counts.enthusiastic + counts.analytical;
      const isHire = positiveSignal > counts.skeptical;

      if (isHire) hireCount++;
      else noHireCount++;

      return { agent: speaker, vote: isHire ? "HIRE" as const : "NO HIRE" as const, isHire };
    });

    // Derive final recommendation from debate tone distribution
    const totalEnthusiastic = debate.filter(t => t.tone === "enthusiastic").length;
    const totalSkeptical = debate.filter(t => t.tone === "skeptical").length;
    
    let finalRecommendation: string;
    if (totalEnthusiastic > debate.length / 2) {
      finalRecommendation = "Strong Hire";
    } else if (hireCount > noHireCount) {
      finalRecommendation = "Hire";
    } else if (hireCount === noHireCount) {
      // Tie-break: if more enthusiastic than skeptical turns overall, lean hire
      finalRecommendation = totalEnthusiastic >= totalSkeptical ? "Hire" : "Pass";
    } else {
      finalRecommendation = "Pass";
    }

    return { calculatedVotes, hireCount, noHireCount, finalRecommendation };
  }, [debate]);

  return (
    <div className="bg-gradient-to-br from-[#14141d] to-[#1a1a2e] border border-indigo-500/30 rounded-xl p-5 mb-6 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
      <h3 className="text-sm font-bold text-white mb-4 border-b border-[#242435] pb-2 flex justify-between items-center">
        <span>Committee Voting Results</span>
        <span className={`px-3 py-1 rounded text-[10px] uppercase font-black ${
          votes.finalRecommendation === "Strong Hire"
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : votes.finalRecommendation === "Hire"
              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
        }`}>
          Decision: {votes.finalRecommendation}
        </span>
      </h3>
      
      <div className={`grid gap-4 mb-4 ${
        votes.calculatedVotes.length <= 2 ? "grid-cols-2" :
        votes.calculatedVotes.length === 3 ? "grid-cols-3" :
        "grid-cols-2 md:grid-cols-4"
      }`}>
        {votes.calculatedVotes.map((v, i) => (
          <div key={i} className="bg-[#0d0d16] border border-[#242435] rounded-lg p-3 text-center flex flex-col items-center justify-center relative overflow-hidden group">
            <div className={`absolute top-0 w-full h-1 ${v.isHire ? "bg-emerald-500" : "bg-rose-500"}`}></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 font-bold">{v.agent}</span>
            <div className={`flex items-center gap-1.5 font-bold ${v.isHire ? "text-emerald-400" : "text-rose-400"}`}>
              {v.isHire ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
              {v.vote}
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-[#0d0d16]/50 rounded p-2 text-center text-xs font-mono text-slate-400">
        FINAL TALLY: <span className="text-emerald-400 font-bold ml-2">HIRE: {votes.hireCount}</span> <span className="text-slate-500 mx-2">|</span> <span className="text-rose-400 font-bold">NO HIRE: {votes.noHireCount}</span>
      </div>
    </div>
  );
}
