"use client";

import React, { memo, Suspense, useState } from "react";
import { X } from "lucide-react";
import type { Candidate, Job } from "@/app/lib/types";
import { ErrorBoundary } from "@/app/components/shared/ErrorBoundary";
import { Skeleton } from "@/app/components/shared/SkeletonLoader";
import { OverviewTab } from "./tabs/OverviewTab";
import { GitHubIntelligenceTab } from "./tabs/GitHubIntelligenceTab";
import { ProfessionalIntelTab } from "./tabs/ProfessionalIntelTab";
import { CommitteeReviewTab } from "./tabs/CommitteeReviewTab";
import { OutreachTab } from "./tabs/OutreachTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "github", label: "GitHub Intelligence" },
  { id: "professional", label: "Professional Intel" },
  { id: "committee", label: "Committee Review" },
  { id: "outreach", label: "Outreach" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  candidate: Candidate;
  job: Job;
  teamSkills: string[];
  jobId: number;
  onClose: () => void;
}

export const CandidateDrawer = memo(function CandidateDrawer({
  candidate,
  job,
  teamSkills,
  jobId,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
      <div className="w-full max-w-2xl bg-[#0c0c14] border-l border-[#242435] h-full shadow-2xl flex flex-col animate-fade-in">
        {/* Header */}
        <div className="p-5 border-b border-[#242435] flex items-center justify-between bg-[#11111b]">
          <div>
            <span className="text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Rank #{candidate.rank}
            </span>
            <h3 className="text-lg font-bold text-white mt-2">{candidate.name}</h3>
            <p className="text-xs text-slate-400">
              {candidate.email} • GitHub: {candidate.github_username}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#242435] bg-[#0c0c14] flex px-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <ErrorBoundary>
            {activeTab === "overview" && (
              <OverviewTab candidate={candidate} job={job} teamSkills={teamSkills} />
            )}
            {activeTab === "github" && (
              <Suspense fallback={<GitHubSkeleton />}>
                <GitHubIntelligenceTab candidateId={candidate.id} />
              </Suspense>
            )}
            {activeTab === "professional" && (
              <Suspense fallback={<Skeleton variant="card" className="mt-2" />}>
                <ProfessionalIntelTab candidateId={candidate.id} />
              </Suspense>
            )}
            {activeTab === "committee" && (
              <CommitteeReviewTab jobId={jobId} candidateId={candidate.id} />
            )}
            {activeTab === "outreach" && (
              <OutreachTab jobId={jobId} candidateId={candidate.id} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
});

function GitHubSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton variant="score" />
      <Skeleton variant="score" />
      <Skeleton variant="chart" />
    </div>
  );
}
