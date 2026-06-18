"use client";

import React, { memo } from "react";
import { useProfessionalAnalysis } from "@/app/hooks/useProfessionalAnalysis";
import { Skeleton } from "@/app/components/shared/SkeletonLoader";
import { DataQualityBadge } from "@/app/components/shared/DataQualityBadge";
import { ScoreRing } from "@/app/components/shared/ScoreRing";

interface Props {
  candidateId: number;
}

export const ProfessionalIntelTab = memo(function ProfessionalIntelTab({ candidateId }: Props) {
  const { data, isLoading, error } = useProfessionalAnalysis(candidateId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton lines={5} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-400 text-xs font-semibold">
        Professional intelligence data unavailable. The analysis endpoint may not be configured yet.
      </div>
    );
  }

  const resume = data.resume_intelligence;
  const career = data.career_trajectory;
  const linkedin = data.linkedin_intelligence;
  const portfolio = data.portfolio_analysis;

  return (
    <div className="space-y-5">
      {/* Resume Intelligence */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 space-y-3">
        <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
          Resume Intelligence
        </h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a28] rounded-lg p-3">
            <p className="text-[10px] text-slate-400 font-medium">Total Career</p>
            <p className="text-sm font-bold text-white mt-0.5">
              {resume?.total_career_months
                ? `${Math.round(resume.total_career_months / 12)} years`
                : "N/A"}
            </p>
          </div>
          <div className="bg-[#1a1a28] rounded-lg p-3">
            <p className="text-[10px] text-slate-400 font-medium">Certifications</p>
            <p className="text-sm font-bold text-white mt-0.5">
              {resume?.certifications?.length || 0}
            </p>
          </div>
        </div>

        {resume?.skills && resume.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {resume.skills.map((s, i) => (
              <span key={i} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700/30 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}

        {resume?.education && resume.education.length > 0 && (
          <div className="pt-2 space-y-1.5">
            {resume.education.map((edu, i) => (
              <div key={i} className="text-xs text-slate-300">
                <span className="font-semibold">{edu.degree}</span> in {edu.field_of_study} — {edu.school}
                {edu.graduation_year && <span className="text-slate-500"> ({edu.graduation_year})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Career Trajectory */}
      {career && (
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 space-y-3">
          <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
            Career Trajectory
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <ScoreCard label="Promotion Velocity" score={career.promo_velocity} color="#8b5cf6" />
            <ScoreCard label="Stability Score" score={career.stability_score} color="#10b981" />
            <ScoreCard label="Level Alignment" score={career.level_alignment} color="#6366f1" />
            <ScoreCard label="Overall Trajectory" score={career.overall} color="#f59e0b" />
          </div>
        </div>
      )}

      {/* LinkedIn Intelligence */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
        <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">
          LinkedIn Intelligence
        </h5>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${
            linkedin?.has_profile ? "bg-blue-500/10 text-blue-400" : "bg-slate-700/20 text-slate-500"
          }`}>
            in
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {linkedin?.has_profile ? "Profile Detected" : "No LinkedIn URL"}
            </p>
            {linkedin?.url && (
              <p className="text-[10px] text-slate-400 truncate max-w-[280px]">{linkedin.url}</p>
            )}
            {linkedin?.profile_strength && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block ${
                linkedin.profile_strength === "strong"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-slate-500/10 text-slate-400"
              }`}>
                {linkedin.profile_strength}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Analysis */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
        <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">
          Portfolio Analysis
        </h5>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${
            portfolio?.has_portfolio ? "bg-purple-500/10 text-purple-400" : "bg-slate-700/20 text-slate-500"
          }`}>
            🌐
          </div>
          <div>
            <p className="text-xs font-semibold text-white">
              {portfolio?.has_portfolio ? "Portfolio Detected" : "No Portfolio URL"}
            </p>
            {portfolio?.url && (
              <p className="text-[10px] text-slate-400 truncate max-w-[280px]">{portfolio.url}</p>
            )}
            {portfolio?.domain_active !== undefined && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold mt-1 inline-block ${
                portfolio.domain_active
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}>
                {portfolio.domain_active ? "Active" : "Inactive"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function ScoreCard({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="bg-[#1a1a28] rounded-lg p-3 flex items-center gap-2.5">
      <ScoreRing score={score} label="" size={40} color={color} />
      <div>
        <p className="text-[10px] text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-white">{Math.round(score * 100)}%</p>
      </div>
    </div>
  );
}
