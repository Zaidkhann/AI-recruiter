"use client";

import React, { memo } from "react";
import { useProfessionalAnalysis } from "@/app/hooks/useProfessionalAnalysis";
import { ScoreRing } from "@/app/components/shared/ScoreRing";
import { DataQualityBadge } from "@/app/components/shared/DataQualityBadge";
import { Skeleton } from "@/app/components/shared/SkeletonLoader";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";

interface Props {
  candidateId: number;
}

const SCORE_COLORS: Record<string, string> = {
  behavioral_score: "#6366f1",
  collaboration_score: "#8b5cf6",
  engineering_maturity: "#10b981",
  technical_depth: "#f59e0b",
  startup_readiness: "#ec4899",
  open_source_influence: "#06b6d4",
  community_impact: "#f97316",
};

const SCORE_LABELS: Record<string, string> = {
  behavioral_score: "Behavioral",
  collaboration_score: "Collaboration",
  engineering_maturity: "Engineering Maturity",
  technical_depth: "Technical Depth",
  startup_readiness: "Startup Readiness",
  open_source_influence: "Open Source Influence",
  community_impact: "Community Impact",
};

export const GitHubIntelligenceTab = memo(function GitHubIntelligenceTab({ candidateId }: Props) {
  const { data, isLoading, error } = useProfessionalAnalysis(candidateId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="score" />
        ))}
        <Skeleton variant="chart" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-400 text-xs font-semibold">
        GitHub intelligence data unavailable. The professional analysis endpoint may not be configured yet.
      </div>
    );
  }

  const gh = data.github_intelligence;
  const scores = data.scores;
  const insights = data.insights;

  // Language bar chart data
  const langData = Object.entries(gh?.languages?.breakdown || {})
    .slice(0, 8)
    .map(([lang, pct]) => ({ language: lang, percentage: pct }));

  return (
    <div className="space-y-5">
      {/* Data Quality Badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          GitHub Intelligence
        </h4>
        <DataQualityBadge
          source={gh?.source || "fallback"}
          quality={gh?.data_quality || "estimated"}
        />
      </div>

      {/* Score Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(SCORE_LABELS).map(([key, label]) => {
          const value = (scores as any)?.[key] ?? 0.5;
          return (
            <div key={key} className="bg-[#14141d] border border-[#242435] rounded-xl p-3.5 github-score-card">
              <ScoreRing
                score={value}
                label={label}
                color={SCORE_COLORS[key]}
                size={48}
              />
            </div>
          );
        })}
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Overall GitHub Score</p>
          <p className="text-2xl font-bold text-indigo-400 mt-1">
            {Math.round((scores?.overall ?? 0.5) * 100)}%
          </p>
        </div>
        <ScoreRing score={scores?.overall ?? 0.5} label="" color="#6366f1" size={64} />
      </div>

      {/* Repository Stats */}
      {gh?.repositories && (
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
          <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">Repository Stats</h5>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Repos" value={gh.repositories.total_count} />
            <Stat label="Stars" value={gh.repositories.total_stars} icon="⭐" />
            <Stat label="Forks" value={gh.repositories.total_forks} icon="🔀" />
            <Stat label="Original" value={gh.repositories.original_repos} />
            <Stat label="Forked" value={gh.repositories.forked_repos} />
            <Stat label="Avg Size" value={`${Math.round(gh.repositories.avg_repo_size_kb)}KB`} />
          </div>
        </div>
      )}

      {/* Language Breakdown */}
      {langData.length > 0 && (
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
          <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">
            Top Languages
          </h5>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={langData} layout="vertical" margin={{ left: 60, right: 10 }}>
                <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 9 }} domain={[0, 100]} />
                <YAxis type="category" dataKey="language" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={55} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#14141d", borderColor: "#242435", fontSize: 11 }}
                  formatter={(val: any) => `${val}%`}
                />
                <Bar dataKey="percentage" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Stats */}
      {gh?.activity && (
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
          <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">
            Recent Activity (90 days)
          </h5>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Commits" value={gh.activity.total_commits_estimated} />
            <Stat label="Push Events" value={gh.activity.total_push_events_90d} />
            <Stat label="PRs" value={gh.activity.total_pr_events_90d} />
            <Stat label="Issues" value={gh.activity.total_issue_events_90d} />
            <Stat label="Active Days" value={gh.activity.contribution_days_90d} />
            <Stat label="Avg/Week" value={gh.activity.avg_weekly_events?.toFixed(1) || "0"} />
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && (
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
          <h5 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mb-3">
            AI Insights
          </h5>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="text-xs text-slate-300 flex gap-2">
                <span className="text-indigo-400 shrink-0">→</span> {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
  return (
    <div className="bg-[#1a1a28] rounded-lg p-2.5">
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">
        {icon && <span className="mr-0.5">{icon}</span>}
        {value}
      </p>
    </div>
  );
}
