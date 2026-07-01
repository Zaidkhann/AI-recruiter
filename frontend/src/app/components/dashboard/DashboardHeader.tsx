"use client";

import React, { memo, useState } from "react";
import { Cpu, Briefcase, RefreshCw, Download } from "lucide-react";
import type { Job, SystemStatus } from "@/app/lib/types";
import { SystemStatusPopover } from "./SystemStatusPopover";
import { apiPost } from "@/app/lib/api";

interface Props {
  jobs: Job[];
  selectedJobId: number | null;
  onJobChange: (id: number) => void;
  systemStatus: SystemStatus | undefined;
  onDataReset: () => void;
}

export const DashboardHeader = memo(function DashboardHeader({
  jobs,
  selectedJobId,
  onJobChange,
  systemStatus,
  onDataReset,
}: Props) {
  const [resetting, setResetting] = useState(false);

  const resetDatabase = async () => {
    setResetting(true);
    try {
      await apiPost("/api/seed-db", {});
      onDataReset();
    } catch {
      alert("Failed to reset database.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="border-b border-[#242435] bg-[#0d0d16] px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 p-2.5 rounded-lg flex items-center justify-center text-white shadow-indigo-500/20 shadow-md">
          <Cpu className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Talent Rank{" "}
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
              AI Architect
            </span>
          </h1>
          <p className="text-xs text-slate-400">Candidate Intelligence &amp; Decision Platform</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {systemStatus && <SystemStatusPopover status={systemStatus} />}

        {jobs.length > 0 && (
          <div className="flex items-center gap-2 bg-[#14141d] border border-[#242435] px-3 py-1.5 rounded-lg">
            <Briefcase className="h-4 w-4 text-indigo-400" />
            <span className="text-xs text-slate-400 font-semibold">Active Role:</span>
            <select
              className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer border-none p-0 font-medium"
              value={selectedJobId || ""}
              onChange={(e) => onJobChange(Number(e.target.value))}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id} className="bg-[#14141d]">
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => window.open(process.env.NEXT_PUBLIC_API_URL + "/api/submission-csv", "_blank")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all active:scale-95 shadow-indigo-500/20 shadow-md"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </button>

        <button
          onClick={resetDatabase}
          disabled={resetting}
          className="flex items-center gap-2 bg-[#1b1b2a] hover:bg-slate-800 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition-all active:scale-95 shadow-inner disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
          Reset &amp; Seed Data
        </button>
      </div>
    </header>
  );
});
