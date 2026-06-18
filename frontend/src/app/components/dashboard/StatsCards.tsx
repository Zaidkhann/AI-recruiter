"use client";

import React, { memo } from "react";
import { UserCheck, Briefcase, AlertCircle, Users } from "lucide-react";
import type { Job, SystemStatus } from "@/app/lib/types";

interface Props {
  candidateCount: number;
  jobCount: number;
  gapsIdentified: string[];
  systemStatus: SystemStatus | undefined;
}

export const StatsCards = memo(function StatsCards({
  candidateCount,
  jobCount,
  gapsIdentified,
  systemStatus,
}: Props) {
  return (
    <section className="px-6 pt-5 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
      <Card
        label="Ranked Candidates"
        value={`${candidateCount} Profiles`}
        desc="Matched to the active job description"
        icon={<UserCheck className="h-6 w-6" />}
        iconBg="bg-emerald-500/10 text-emerald-400"
      />
      <Card
        label="Active Job Roles"
        value={`${jobCount} Roles`}
        desc="Available in database registry"
        icon={<Briefcase className="h-6 w-6" />}
        iconBg="bg-indigo-500/10 text-indigo-400"
      />
      <Card
        label="Active Team Skill Gaps"
        value={`${gapsIdentified.length} Detected`}
        desc={
          gapsIdentified.length > 0
            ? `Missing: ${gapsIdentified.slice(0, 3).join(", ")}${gapsIdentified.length > 3 ? "..." : ""}`
            : "All required skills present in team"
        }
        descColor={gapsIdentified.length > 0 ? "text-yellow-400" : undefined}
        icon={<AlertCircle className="h-6 w-6" />}
        iconBg="bg-yellow-500/10 text-yellow-400"
      />
      <Card
        label="Evaluated Profiles"
        value={`${systemStatus?.candidates || 0} Resumes`}
        desc="Twin-Graph node mappings complete"
        icon={<Users className="h-6 w-6" />}
        iconBg="bg-purple-500/10 text-purple-400"
      />
    </section>
  );
});

interface CardProps {
  label: string;
  value: string;
  desc: string;
  descColor?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function Card({ label, value, desc, descColor, icon, iconBg }: CardProps) {
  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">{label}</p>
        <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
        <p className={`text-[10px] mt-1 ${descColor || "text-slate-400"}`}>{desc}</p>
      </div>
      <div className={`p-3 rounded-lg ${iconBg}`}>{icon}</div>
    </div>
  );
}
