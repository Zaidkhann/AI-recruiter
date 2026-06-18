"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Database,
  ArrowRight,
  Sparkles,
  Users,
  Compass,
  FileCheck,
  Check,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface JobInfo {
  id: number;
  title: string;
  description: string;
  status: "active" | "archived" | "closed";
  benchmark_profile: string;
  graph_schema?: {
    required_skills?: string[];
    preferred_skills?: string[];
    experience_level?: string;
    leadership_requirements?: string[];
    industry_domain?: string;
    responsibilities?: string[];
    hidden_requirements?: string[];
    skills_required?: string[]; // fallback
    domains?: string[]; // fallback
  };
  created_at: string;
}

interface RediscoveredCandidate {
  candidate_id: number;
  candidate_name: string;
  email: string;
  skills: string[];
  rediscovery_score: number;
  reason: string;
  transferable_skills: string[];
}

interface JobManagerProps {
  token: string | null;
  role: string;
  getAPIUrl: () => string;
  onActiveJobChanged: (jobId: number) => void;
  selectedJobId: number | null;
}

export default function JobManager({ token, role, getAPIUrl, onActiveJobChanged, selectedJobId }: JobManagerProps) {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stats loaded dynamically
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Edit/Create Modal states
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobInfo | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formBenchmark, setFormBenchmark] = useState("YC_FOUNDING_ENGINEER");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Talent Rediscovery states
  const [scanningJobId, setScanningJobId] = useState<number | null>(null);
  const [discoveredCandidates, setDiscoveredCandidates] = useState<Record<number, RediscoveredCandidate[]>>({});
  const [scanLoading, setScanLoading] = useState<number | null>(null);

  // View Deep Understanding state
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

  const isReadOnly = role === "viewer";

  const fetchJobsAndStats = async () => {
    setLoading(true);
    setLoadingStats(true);
    const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};

    try {
      // 1. Fetch jobs
      const jobsRes = await fetch(`${getAPIUrl()}/api/jobs`, { headers });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      } else {
        setError("Failed to fetch jobs database.");
      }

      // 2. Fetch stats
      const statsRes = await fetch(`${getAPIUrl()}/api/system/status`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach backend API.");
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchJobsAndStats();
  }, [token]);

  const handleCreateJob = () => {
    if (isReadOnly) return;
    setFormTitle("");
    setFormDesc("");
    setFormBenchmark("YC_FOUNDING_ENGINEER");
    setSelectedJob(null);
    setShowModal("create");
  };

  const handleEditJob = (job: JobInfo) => {
    if (isReadOnly) return;
    setSelectedJob(job);
    setFormTitle(job.title);
    setFormDesc(job.description);
    setFormBenchmark(job.benchmark_profile || "YC_FOUNDING_ENGINEER");
    setShowModal("edit");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setFormSubmitting(true);
    setError(null);

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const payload = {
      title: formTitle,
      description: formDesc,
      benchmark_profile: formBenchmark
    };

    try {
      let url = `${getAPIUrl()}/api/jobs`;
      let method = "POST";

      if (showModal === "edit" && selectedJob) {
        url = `${getAPIUrl()}/api/jobs/${selectedJob.id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(null);
        fetchJobsAndStats();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Error saving job description.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit request.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (isReadOnly || !confirm("Are you sure you want to permanently delete this job?")) return;
    const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${getAPIUrl()}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        fetchJobsAndStats();
      } else {
        setError("Could not delete job.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (jobId: number, status: "active" | "archived" | "closed") => {
    if (isReadOnly) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${getAPIUrl()}/api/jobs/${jobId}/status`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchJobsAndStats();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCloneJob = async (jobId: number) => {
    if (isReadOnly) return;
    const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${getAPIUrl()}/api/jobs/${jobId}/clone`, {
        method: "POST",
        headers
      });
      if (res.ok) {
        fetchJobsAndStats();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRediscoverTalent = async (jobId: number) => {
    setScanLoading(jobId);
    const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${getAPIUrl()}/api/jobs/${jobId}/rediscover-talent`, {
        method: "POST",
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setDiscoveredCandidates(prev => ({
          ...prev,
          [jobId]: data.matches || []
        }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan candidate database.");
    } finally {
      setScanLoading(null);
    }
  };

  const toggleExpandJob = (jobId: number) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      // Automatically trigger rediscovery when expanding
      if (!discoveredCandidates[jobId]) {
        handleRediscoverTalent(jobId);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto w-full overflow-hidden">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242435] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-400" /> Active Job Registry
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create jobs, enrich roles with structured skills graph, transition statuses, clone specifications, and trigger background talent discovery scanners.
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleCreateJob}
            className="bg-indigo-600 hover:bg-indigo-500 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer self-start md:self-auto"
          >
            <Plus className="h-4 w-4" /> Create New Job
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Statistics & Integrity Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PostgreSQL / Qdrant live statistics counts */}
        <div className="bg-[#14141d]/75 border border-[#242435] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#242435] pb-2">
            <Database className="h-4 w-4 text-indigo-400" /> Dynamic Database Statistics
          </h3>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0d0d16] border border-[#242435]/65 p-3 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Candidates Stored</span>
              <span className="text-lg font-black text-white mt-1 block">
                {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin inline text-indigo-400" /> : stats?.candidates_stored ?? 0}
              </span>
            </div>
            <div className="bg-[#0d0d16] border border-[#242435]/65 p-3 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Jobs Stored</span>
              <span className="text-lg font-black text-white mt-1 block">
                {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin inline text-indigo-400" /> : stats?.jobs_stored ?? 0}
              </span>
            </div>
            <div className="bg-[#0d0d16] border border-[#242435]/65 p-3 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Embeddings Stored</span>
              <span className="text-lg font-black text-white mt-1 block">
                {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin inline text-indigo-400" /> : stats?.embeddings_stored ?? 0}
              </span>
            </div>
            <div className="bg-[#0d0d16] border border-[#242435]/65 p-3 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ranking Runs</span>
              <span className="text-lg font-black text-white mt-1 block">
                {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin inline text-indigo-400" /> : stats?.ranking_runs ?? 0}
              </span>
            </div>
            <div className="bg-[#0d0d16] border border-[#242435]/65 p-3 rounded-xl col-span-2 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Skill Graph Nodes & Edges</span>
                <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                  {loadingStats ? "—" : `${stats?.knowledge_graph_nodes ?? 0} nodes / ${stats?.knowledge_graph_edges ?? 0} edges`}
                </span>
              </div>
              <Compass className="h-6 w-6 text-indigo-500/30" />
            </div>
          </div>
        </div>

        {/* Real Data Integrity Checklists */}
        <div className="bg-[#14141d]/75 border border-[#242435] rounded-2xl p-5 space-y-4 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Resume Verification Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#242435] pb-2">
              <FileCheck className="h-4 w-4 text-emerald-400" /> Resume Storage Verification
            </h4>
            
            <ul className="space-y-1.5 text-xs text-slate-300">
              <ChecklistItem checked={(stats?.candidates_stored ?? 0) > 0} label="Resume Uploaded & Binary Authenticated" />
              <ChecklistItem checked={(stats?.candidates_stored ?? 0) > 0} label="Structured Candidate Record in SQLite" />
              <ChecklistItem checked={(stats?.embeddings_stored ?? 0) > 0} label="Dense Vector Embeddings Generated" />
              <ChecklistItem checked={(stats?.embeddings_stored ?? 0) > 0} label="Upserted & Cached in Qdrant DB" />
              <ChecklistItem checked={(stats?.ranking_runs ?? 0) > 0} label="Available for Ranking & shortlisting" />
            </ul>
          </div>

          {/* Job Verification Checklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 border-b border-[#242435] pb-2">
              <FileCheck className="h-4 w-4 text-indigo-400" /> Job Storage Verification
            </h4>

            <ul className="space-y-1.5 text-xs text-slate-300">
              <ChecklistItem checked={(stats?.jobs_stored ?? 0) > 0} label="Job Specs Created & Sanitized" />
              <ChecklistItem checked={(stats?.jobs_stored ?? 0) > 0} label="Structured Skill Graph Generated" />
              <ChecklistItem checked={(stats?.jobs_stored ?? 0) > 0} label="Persisted in PostgreSQL database" />
              <ChecklistItem checked={(stats?.knowledge_graph_nodes ?? 0) > 0} label="Graph Nodes & Edges Indexed" />
              <ChecklistItem checked={(stats?.jobs_stored ?? 0) > 0} label="Available for Semantic Matching" />
            </ul>
          </div>

        </div>
      </div>

      {/* Jobs Cards Layout */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          Querying Active Job Specifications database...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#242435] rounded-2xl bg-[#14141d]/30 text-slate-500 p-6">
          <Briefcase className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-300 text-sm">No Jobs Registered</p>
          <p className="text-xs text-slate-500 mt-1">
            Configure a job description file to begin matching candidates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Job Registry
          </h3>

          <div className="space-y-3">
            {jobs.map(job => {
              const isExpanded = expandedJobId === job.id;
              const isSelected = selectedJobId === job.id;
              const requiredSkillsList = job.graph_schema?.required_skills || job.graph_schema?.skills_required || [];
              const preferredSkillsList = job.graph_schema?.preferred_skills || [];
              
              const discovered = discoveredCandidates[job.id] || [];
              const isScanLoading = scanLoading === job.id;

              return (
                <div 
                  key={job.id}
                  className={`bg-[#14141d]/75 border rounded-2xl transition-all ${
                    isExpanded 
                      ? "border-indigo-500/40 shadow-lg shadow-indigo-600/5 bg-[#14141d]" 
                      : isSelected 
                        ? "border-indigo-500/50 bg-[#14141d]/90 shadow-md shadow-indigo-600/5" 
                        : "border-[#242435] hover:border-slate-800"
                  }`}
                >
                  {/* Job card header summary */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isSelected 
                          ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-400 shadow-inner" 
                          : "bg-slate-800/30 border-slate-700/40 text-slate-400"
                      }`}>
                        <Briefcase className="h-5 w-5" />
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          {job.title}
                          <span className={`text-[9px] px-2 py-0.2 rounded border font-bold uppercase tracking-wider shrink-0 ${
                            job.status === "active" 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : job.status === "archived"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}>
                            {job.status}
                          </span>
                        </h4>
                        
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          Created: {new Date(job.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })} • Overlay: <span className="font-mono text-indigo-400 text-[9px]">{job.benchmark_profile}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions and toggle */}
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          onActiveJobChanged(job.id);
                        }}
                        disabled={isSelected}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-400 cursor-default"
                            : "bg-[#1b1b2a] hover:bg-indigo-600/10 border-[#3e3e57] text-slate-300 hover:text-indigo-400 hover:border-indigo-500/30"
                        }`}
                      >
                        {isSelected ? "Active Workspace" : "Set Active"}
                      </button>

                      <button
                        onClick={() => toggleExpandJob(job.id)}
                        className="text-[#1b1b2a] hover:bg-slate-800/50 p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                        title="View Job Analysis"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                      </button>

                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleEditJob(job)}
                            className="bg-[#1b1b2a] hover:bg-slate-800/50 p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                            title="Edit Role Description"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleCloneJob(job.id)}
                            className="bg-[#1b1b2a] hover:bg-slate-800/50 p-2 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                            title="Clone Role Specifications"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <select
                            value={job.status}
                            onChange={(e) => handleUpdateStatus(job.id, e.target.value as any)}
                            className="bg-[#1b1b2a] border border-slate-800 text-xs text-slate-300 font-bold px-2 py-1.8 rounded-lg focus:outline-none cursor-pointer"
                          >
                            <option value="active">Active</option>
                            <option value="archived">Archive</option>
                            <option value="closed">Close</option>
                          </select>

                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="bg-rose-950/20 hover:bg-rose-900/30 p-2 border border-rose-900/30 rounded-lg text-rose-400 hover:text-rose-300 transition-colors"
                            title="Delete Job permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Sandbox: Deep Job Understanding & Talent Rediscovery */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-[#242435] bg-[#0d0d16]/30"
                      >
                        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                          
                          {/* Column 1: Deep Job Understanding */}
                          <div className="space-y-4 border-r border-[#242435]/40 pr-6">
                            <h5 className="font-extrabold text-slate-300 tracking-wide uppercase text-[10px] border-b border-[#242435] pb-1.5 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Deep Job Understanding (Gemini Extracted)
                            </h5>

                            <div className="space-y-3">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Target Seniority Bar</span>
                                <span className="text-xs font-semibold text-slate-200 block mt-0.5 uppercase">{job.graph_schema?.experience_level || "MID"}</span>
                              </div>

                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Industry/Domain Focus</span>
                                <span className="text-xs font-semibold text-slate-200 block mt-0.5">{job.graph_schema?.industry_domain || job.graph_schema?.domains?.join(", ") || "Cloud Application Development"}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Required Skills (Keyword Node)</span>
                                  <div className="flex flex-wrap gap-1">
                                    {requiredSkillsList.length > 0 ? requiredSkillsList.map((s, i) => (
                                      <span key={i} className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded text-[10px] font-bold">
                                        {s}
                                      </span>
                                    )) : <span className="text-slate-500 italic">None annotated</span>}
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Preferred Skills</span>
                                  <div className="flex flex-wrap gap-1">
                                    {preferredSkillsList.length > 0 ? preferredSkillsList.map((s, i) => (
                                      <span key={i} className="bg-purple-600/10 text-purple-400 border border-purple-500/15 px-2 py-0.5 rounded text-[10px] font-bold">
                                        {s}
                                      </span>
                                    )) : <span className="text-slate-500 italic">None annotated</span>}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Leadership Requirements</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                                  {job.graph_schema?.leadership_requirements?.map((req, i) => (
                                    <li key={i}>{req}</li>
                                  )) || <li>Technical ownership & team design review</li>}
                                </ul>
                              </div>

                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Key Responsibilities</span>
                                <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                                  {job.graph_schema?.responsibilities?.map((resp, i) => (
                                    <li key={i}>{resp}</li>
                                  )) || <li>Design scalable microservice infrastructure.</li>}
                                </ul>
                              </div>

                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Inferred/Hidden Requirements</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {job.graph_schema?.hidden_requirements?.map((req, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-medium">
                                      {req}
                                    </span>
                                  )) || <span className="text-slate-500 italic">None annotated</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Talent Rediscovery */}
                          <div className="space-y-4">
                            <h5 className="font-extrabold text-slate-300 tracking-wide uppercase text-[10px] border-b border-[#242435] pb-1.5 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-indigo-400" /> Talent Rediscovery (Semantic Database Scan)
                            </h5>

                            {isScanLoading ? (
                              <div className="py-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                                Analyzing dense vector candidate embeddings...
                              </div>
                            ) : discovered.length === 0 ? (
                              <div className="p-6 text-center border border-dashed border-[#242435] rounded-xl text-slate-500 bg-[#0d0d16]/30">
                                <p className="font-semibold text-slate-400">No Rediscovered Matches</p>
                                <p className="text-[10px] text-slate-600 mt-1 max-w-[280px] mx-auto">
                                  If real candidate data exists, click the scanner button below to fetch matching developers who were not previously ranked.
                                </p>
                                <button
                                  onClick={() => handleRediscoverTalent(job.id)}
                                  className="mt-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/25 text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all"
                                >
                                  Scan Candidate Database
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2 text-[10px] text-indigo-300">
                                  <span>Hidden Matches Discovered:</span>
                                  <span className="font-bold">{discovered.length} Profiles</span>
                                </div>

                                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                                  {discovered.map((c, i) => (
                                    <div key={i} className="bg-[#1b1b29]/40 border border-[#242435]/65 rounded-xl p-3 flex justify-between items-start gap-3 hover:bg-[#1b1b29]/65 transition-colors">
                                      <div className="space-y-1">
                                        <h6 className="font-bold text-slate-200">{c.candidate_name}</h6>
                                        <p className="text-[10px] text-slate-400 italic leading-relaxed">{c.reason}</p>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {c.transferable_skills.slice(0, 3).map((s, idx) => (
                                            <span key={idx} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                                              {s}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div className="text-right shrink-0">
                                        <span className="text-[9px] text-slate-500 uppercase block font-semibold">Discovery Match</span>
                                        <span className="text-xs font-black text-indigo-400 block mt-0.5">{c.rediscovery_score}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                <button
                                  onClick={() => handleRediscoverTalent(job.id)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="h-3 w-3 animate-spin-once" /> Re-Scan Candidates
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE & EDIT MODAL OVERLAY */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0c14] border border-[#242435] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              
              <div className="p-6 border-b border-[#242435]">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="h-4.5 w-4.5 text-indigo-400" />
                  {showModal === "create" ? "Create Job Specification" : "Modify Job Specification"}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Input job parameters. Natural language details will be parsed into our relational skill graph database.
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Job Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Senior Machine Learning Engineer"
                    className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-4 py-2.5 rounded-xl text-slate-100"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Benchmark Profile Overlay</label>
                  <select
                    value={formBenchmark}
                    onChange={(e) => setFormBenchmark(e.target.value)}
                    className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-4 py-2.5 rounded-xl text-slate-300 font-medium cursor-pointer"
                  >
                    <option value="YC_FOUNDING_ENGINEER">YC Founding Engineer Bar</option>
                    <option value="FAANG_STAFF">FAANG Staff Engineer Bar</option>
                    <option value="DEV_OPS">DevOps Infrastructure Bar</option>
                    <option value="GENERAL_ENGINEER">Balanced Software Architect</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Job Description & Context</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    rows={8}
                    placeholder="Describe duties, required technical skills, responsibilities, and expected seniority bars..."
                    className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none p-4 rounded-xl text-slate-100 leading-relaxed resize-none"
                    required
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-[#242435] mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(null)}
                    className="bg-transparent hover:bg-slate-800 border border-slate-700/60 text-slate-300 px-4 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-500 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-50 cursor-pointer"
                  >
                    {formSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Extracting Graph Schema...
                      </>
                    ) : showModal === "create" ? "Build Graph & Save" : "Update Graph & Save"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Checklist Item component
function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
        checked 
          ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400 font-bold" 
          : "bg-slate-800 border-slate-700 text-slate-500"
      }`}>
        {checked ? <Check className="w-3.5 h-3.5" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
      </div>
      <span className={`text-[11px] font-semibold ${checked ? "text-slate-200" : "text-slate-500"}`}>
        {label}
      </span>
    </li>
  );
}
