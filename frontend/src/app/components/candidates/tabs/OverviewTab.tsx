"use client";

import React, { memo, useMemo } from "react";
import { BarChart2, Users } from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";
import type { Candidate, Job } from "@/app/lib/types";
import { TeamHeatmap } from "../TeamHeatmap";

interface Props {
  candidate: Candidate;
  job: Job;
  teamSkills: string[];
}

export const OverviewTab = memo(function OverviewTab({ candidate, job, teamSkills }: Props) {
  const radarData = useMemo(() => {
    if (!candidate.factors) return [];
    return [
      { subject: "Semantic Fit", score: candidate.factors.semantic * 100 },
      { subject: "Skill Adjacency", score: candidate.factors.adjacency * 100 },
      { subject: "Career Velocity", score: candidate.factors.trajectory * 100 },
      { subject: "GitHub Activity", score: candidate.factors.behavioral * 100 },
      { subject: "Tenure Stability", score: candidate.factors.success * 100 },
      { subject: "Learning Velocity", score: candidate.factors.learning * 100 },
      { subject: "Market Trend", score: candidate.factors.market * 100 },
      { subject: "Future Potential", score: candidate.factors.potential * 100 },
    ];
  }, [candidate.factors]);

  const teamGapData = useMemo(() => {
    const reqSkills = job.graph_schema?.skills_required || [];
    return reqSkills.map((skill: string) => {
      const inTeam = teamSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase());
      const inCandidate = candidate.skills.map((s) => s.toLowerCase()).includes(skill.toLowerCase());
      return {
        skill,
        "Team Has Skill": inTeam ? 100 : 0,
        "Candidate Has Skill": inCandidate ? 100 : 0,
        gapFilled: !inTeam && inCandidate,
      };
    });
  }, [job.graph_schema, teamSkills, candidate.skills]);

  return (
    <div className="space-y-6">
      {/* Candidate Summary */}
      <div className="grid grid-cols-2 gap-3">
        <InfoBlock label="Location" value={candidate.location || "N/A"} />
        <InfoBlock label="Phone" value={candidate.phone || "N/A"} />
        <InfoBlock label="Final Score" value={`${Math.round(candidate.final_score * 100)}%`} />
        <InfoBlock label="Raw Score" value={`${Math.round(candidate.raw_score * 100)}%`} />
      </div>

      {/* Skills */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Skills</h4>
        <div className="flex flex-wrap gap-1.5">
          {candidate.skills.map((s, i) => (
            <span key={i} className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full font-medium">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <BarChart2 className="h-4 w-4 text-indigo-400" /> Multi-Factor Score Distribution
        </h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="#242435" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 8 }} />
              <Radar name={candidate.name} dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team Gap Heatmap */}
      <TeamHeatmap 
        candidateSkills={candidate.skills}
        requiredSkills={job.graph_schema?.skills_required || []}
        teamSkills={teamSkills}
      />
    </div>
  );
});

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">{value}</p>
    </div>
  );
}
