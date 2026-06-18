"use client";

import React from "react";
import { Award, Users, Shield, Briefcase, Zap, TrendingUp } from "lucide-react";

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

interface LinkedInIntelCardProps {
  linkedinIntel?: {
    professional_score: number;
    leadership_score: number;
    industry_authority: number;
    career_progression: number;
    certification_strength: number;
    activity_score: number;
    overall_linkedin_score: number;
    data_quality: "high" | "medium" | "low";
  };
}

export function LinkedInIntelCard({ linkedinIntel }: LinkedInIntelCardProps) {
  if (!linkedinIntel) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-[#242435] bg-[#14141d]/50 text-center text-slate-500 text-xs">
        No LinkedIn intelligence profile calculated.
      </div>
    );
  }

  const {
    professional_score = 0.5,
    leadership_score = 0.5,
    industry_authority = 0.5,
    career_progression = 0.5,
    certification_strength = 0.5,
    activity_score = 0.5,
    overall_linkedin_score = 0.5,
    data_quality = "medium",
  } = linkedinIntel;

  // Radar chart calculations (using standard hexagon coordinate mapping)
  const center = 100;
  const maxVal = 80;
  const labels = [
    { name: "Professional Fit", key: "professional_score", val: professional_score },
    { name: "Leadership", key: "leadership_score", val: leadership_score },
    { name: "Authority", key: "industry_authority", val: industry_authority },
    { name: "Progression", key: "career_progression", val: career_progression },
    { name: "Certs", key: "certification_strength", val: certification_strength },
    { name: "Activity", key: "activity_score", val: activity_score },
  ];

  // Helper to get coordinates around hexagon
  const getCoordinates = (index: number, value: number) => {
    const angle = (index * 2 * Math.PI) / 6 - Math.PI / 2;
    const r = value * maxVal;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Build grid hexagons
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridHexagons = gridLevels.map((level) => {
    return Array.from({ length: 6 })
      .map((_, idx) => {
        const { x, y } = getCoordinates(idx, level);
        return `${x},${y}`;
      })
      .join(" ");
  });

  // Candidate data points
  const candidatePoints = labels
    .map((item, idx) => {
      const { x, y } = getCoordinates(idx, item.val);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="bg-[#14141d]/90 border border-[#242435] rounded-xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row gap-6">
      
      {/* Visual Radar Overlay */}
      <div className="flex flex-col items-center gap-3 shrink-0 mx-auto">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
          Skill Dimension Radar
        </span>
        <div className="relative w-[200px] height-[200px]">
          <svg width="200" height="200" className="block">
            {/* Hexagonal grid boundaries */}
            {gridHexagons.map((hex, idx) => (
              <polygon
                key={idx}
                points={hex}
                fill="none"
                stroke="#242435"
                strokeWidth={idx === 3 ? "1.5" : "0.75"}
              />
            ))}
            
            {/* Spoke lines */}
            {Array.from({ length: 6 }).map((_, idx) => {
              const { x, y } = getCoordinates(idx, 1.0);
              return (
                <line
                  key={idx}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#242435"
                  strokeWidth="0.75"
                />
              );
            })}

            {/* Candidate Score Area */}
            <polygon
              points={candidatePoints}
              fill="rgba(99, 102, 241, 0.25)"
              stroke="#6366f1"
              strokeWidth="2"
            />

            {/* Data points dots */}
            {labels.map((item, idx) => {
              const { x, y } = getCoordinates(idx, item.val);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="#818cf8"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              );
            })}
          </svg>

          {/* Mini labels around radar */}
          <span className="absolute left-[84px] -top-1 text-[8px] font-bold text-slate-400">FIT</span>
          <span className="absolute -right-2 top-[92px] text-[8px] font-bold text-slate-400">LEAD</span>
          <span className="absolute -right-3 top-[170px] text-[8px] font-bold text-slate-400">AUTH</span>
          <span className="absolute left-[72px] bottom-[2px] text-[8px] font-bold text-slate-400">PROGRESS</span>
          <span className="absolute -left-2 top-[170px] text-[8px] font-bold text-slate-400">CERTS</span>
          <span className="absolute -left-3 top-[92px] text-[8px] font-bold text-slate-400">ACTIVE</span>
        </div>

        {/* Quality indicator */}
        <div className="flex gap-2 items-center bg-[#0d0d16] border border-[#242435] px-2.5 py-1 rounded-md text-[10px]">
          <span className="text-slate-500 font-bold uppercase">Profile Strength:</span>
          <span className={`font-extrabold uppercase ${
            data_quality === "high" ? "text-emerald-400" : data_quality === "medium" ? "text-amber-400" : "text-red-400"
          }`}>
            {data_quality}
          </span>
        </div>
      </div>

      {/* Details list */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Overall score */}
        <div className="flex justify-between items-center border-b border-[#242435] pb-2">
          <div className="flex items-center gap-2">
            <LinkedinIcon className="w-4 h-4 text-blue-400 fill-current" />
            <h4 className="text-sm font-bold text-slate-200">Professional Intelligence</h4>
          </div>
          <span className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            {Math.round(overall_linkedin_score * 100)}/100
          </span>
        </div>

        {/* Dimension breakdowns */}
        <div className="space-y-3">
          {labels.map((item) => {
            const pct = Math.round(item.val * 100);
            
            // Icon assigner
            let icon = <Award className="w-3.5 h-3.5" />;
            if (item.key === "professional_score") icon = <Briefcase className="w-3.5 h-3.5 text-blue-400" />;
            if (item.key === "leadership_score") icon = <Users className="w-3.5 h-3.5 text-indigo-400" />;
            if (item.key === "industry_authority") icon = <Shield className="w-3.5 h-3.5 text-amber-400" />;
            if (item.key === "career_progression") icon = <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
            if (item.key === "certification_strength") icon = <Award className="w-3.5 h-3.5 text-purple-400" />;
            if (item.key === "activity_score") icon = <Zap className="w-3.5 h-3.5 text-pink-400" />;

            return (
              <div key={item.key} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-[#1b1b29] border border-[#2c2c3e] flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span>{item.name}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1b1b29] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
