"use client";

import React, { memo } from "react";
import { CheckCircle, AlertCircle, HelpCircle, Mail } from "lucide-react";
import { useDecision } from "@/app/hooks/useDecision";
import { Skeleton } from "@/app/components/shared/SkeletonLoader";

interface Props {
  jobId: number;
  candidateId: number;
}

export const OutreachTab = memo(function OutreachTab({ jobId, candidateId }: Props) {
  const { data, isLoading, error } = useDecision(jobId, candidateId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton lines={6} />
      </div>
    );
  }

  if (error || !data || data.status === "unavailable") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-400 text-xs font-semibold">
        <AlertCircle className="h-5 w-5 shrink-0" />
        Decision intelligence card is unavailable because the LLM service is offline or Gemini API
        Key is missing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2.5">
          <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" /> Evidence Strengths
          </h5>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {data.strengths?.map((str, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-emerald-500">•</span> {str}
              </li>
            )) || <p className="text-xs text-slate-500">No strengths data available.</p>}
          </ul>
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2.5">
          <h5 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Gaps &amp; Risks
          </h5>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {data.risks?.map((risk, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-rose-500">•</span> {risk}
              </li>
            )) || <p className="text-xs text-slate-500">No risks data available.</p>}
          </ul>
        </div>
      </div>

      {/* Interview Questions */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4 text-indigo-400" /> Customized Interview Prep
        </h4>
        <div className="space-y-4">
          {data.interview_questions?.map((q, idx) => (
            <div key={idx} className="border-l-2 border-indigo-500 pl-4 space-y-1.5">
              <p className="text-xs font-bold text-slate-100">{q.question}</p>
              <p className="text-[10px] text-indigo-300">
                <span className="font-bold">Rationale:</span> {q.rationale}
              </p>
              <p className="text-[10px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                <span className="font-bold text-slate-300">Expected Answer Focus:</span>{" "}
                {q.expected_ideal_answer}
              </p>
            </div>
          )) || <p className="text-xs text-slate-500">No interview prep questions available.</p>}
        </div>
      </div>

      {/* Email Outreach */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-indigo-400" /> Executive Outreach Draft
          </h4>
          {data.outreach_email && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(data.outreach_email);
                alert("Email draft copied to clipboard!");
              }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
            >
              Copy Draft
            </button>
          )}
        </div>
        <pre className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-900 whitespace-pre-wrap font-mono leading-relaxed">
          {data.outreach_email || "No outreach draft available."}
        </pre>
      </div>
    </div>
  );
});
