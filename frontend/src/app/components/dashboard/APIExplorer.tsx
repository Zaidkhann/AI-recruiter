"use client";

import React, { useState } from "react";
import { 
  Send, 
  Terminal, 
  ShieldCheck, 
  Clock, 
  Activity, 
  Layers,
  ChevronDown, 
  ChevronUp, 
  Check, 
  Copy,
  Lock,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EndpointInfo {
  id: string;
  category: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: "None" | "Viewer" | "Recruiter" | "Admin";
  defaultBody?: string;
  defaultPathParams?: Record<string, string>;
}

const ENDPOINTS: EndpointInfo[] = [
  {
    id: "login",
    category: "Authentication",
    method: "POST",
    path: "/api/auth/login",
    description: "Authenticate user and retrieve JSON Web Token (JWT).",
    auth: "None",
    defaultBody: JSON.stringify({ username: "admin", password: "admin123" }, null, 2)
  },
  {
    id: "register",
    category: "Authentication",
    method: "POST",
    path: "/api/auth/register",
    description: "Register a new user account with role permissions.",
    auth: "None",
    defaultBody: JSON.stringify({ username: "new_recruiter", password: "recruiter123", role: "recruiter" }, null, 2)
  },
  {
    id: "me",
    category: "Authentication",
    method: "GET",
    path: "/api/auth/me",
    description: "Get authenticated session profile metadata.",
    auth: "Viewer"
  },
  {
    id: "get_jobs",
    category: "Jobs",
    method: "GET",
    path: "/api/jobs",
    description: "Retrieve all active jobs from PostgreSQL database.",
    auth: "Viewer"
  },
  {
    id: "create_job",
    category: "Jobs",
    method: "POST",
    path: "/api/jobs",
    description: "Create new job and parse with Gemini to build skill graph.",
    auth: "Recruiter",
    defaultBody: JSON.stringify({
      title: "Senior Cloud Engineer",
      description: "We are seeking a senior systems engineer with experience in Docker, Kubernetes, AWS, and Python to scale infrastructure.",
      benchmark_profile: "YC_FOUNDING_ENGINEER"
    }, null, 2)
  },
  {
    id: "edit_job",
    category: "Jobs",
    method: "PUT",
    path: "/api/jobs/{id}",
    description: "Edit job description and re-parse structured graph nodes.",
    auth: "Recruiter",
    defaultPathParams: { id: "1" },
    defaultBody: JSON.stringify({
      title: "Lead Infrastructure Architect",
      description: "Lead architecture rewrite in Rust, C++, Kubernetes, and GCP.",
      benchmark_profile: "FAANG_STAFF"
    }, null, 2)
  },
  {
    id: "delete_job",
    category: "Jobs",
    method: "DELETE",
    path: "/api/jobs/{id}",
    description: "Permanently delete job from PostgreSQL storage.",
    auth: "Recruiter",
    defaultPathParams: { id: "2" }
  },
  {
    id: "update_job_status",
    category: "Jobs",
    method: "PUT",
    path: "/api/jobs/{id}/status",
    description: "Transition job state to Active, Archived, or Closed.",
    auth: "Recruiter",
    defaultPathParams: { id: "1" },
    defaultBody: JSON.stringify({ status: "archived" }, null, 2)
  },
  {
    id: "clone_job",
    category: "Jobs",
    method: "POST",
    path: "/api/jobs/{id}/clone",
    description: "Clone job description and graph representation.",
    auth: "Recruiter",
    defaultPathParams: { id: "1" }
  },
  {
    id: "rediscover_talent",
    category: "Jobs",
    method: "POST",
    path: "/api/jobs/{job_id}/rediscover-talent",
    description: "Find matching candidates in database using vector retrieval.",
    auth: "Recruiter",
    defaultPathParams: { job_id: "1" }
  },
  {
    id: "get_candidates",
    category: "Candidates",
    method: "GET",
    path: "/api/candidates",
    description: "Get all candidates stored in PostgreSQL registry.",
    auth: "Viewer"
  },
  {
    id: "get_candidate",
    category: "Candidates",
    method: "GET",
    path: "/api/candidates/{id}",
    description: "Fetch single candidate profile details.",
    auth: "Viewer",
    defaultPathParams: { id: "1" }
  },
  {
    id: "github_analysis",
    category: "Candidates",
    method: "GET",
    path: "/api/candidates/{id}/github-analysis",
    description: "Fetch verified candidate GitHub activity & developer behavior.",
    auth: "Viewer",
    defaultPathParams: { id: "1" }
  },
  {
    id: "rank",
    category: "Ranking",
    method: "POST",
    path: "/api/rank",
    description: "Run multi-factor scoring matching pipeline across 8 vectors.",
    auth: "Viewer",
    defaultBody: JSON.stringify({
      job_id: 1,
      weights: {
        semantic: 0.7,
        adjacency: 0.8,
        trajectory: 0.5,
        behavioral: 0.6
      },
      benchmark_profile: "YC_FOUNDING_ENGINEER"
    }, null, 2)
  },
  {
    id: "compare",
    category: "Ranking",
    method: "GET",
    path: "/api/rank/compare",
    description: "Compare two candidates on factor difference matrix.",
    auth: "Viewer",
    defaultBody: "",
    defaultPathParams: { job_id: "1", candidate_a: "1", candidate_b: "2" }
  },
  {
    id: "copilot",
    category: "Copilot",
    method: "POST",
    path: "/api/copilot",
    description: "Send natural language query to Gemini Recruiter Copilot agent.",
    auth: "Recruiter",
    defaultBody: JSON.stringify({
      session_id: "demo-session-id",
      job_id: 1,
      prompt: "Adjust weights to prioritize low-level coding experience."
    }, null, 2)
  },
  {
    id: "audit_logs",
    category: "Administration",
    method: "GET",
    path: "/api/admin/audit-logs",
    description: "Fetch immutable system security audit trails (Admin only).",
    auth: "Admin"
  },
  {
    id: "seed_db",
    category: "Administration",
    method: "POST",
    path: "/api/seed-db",
    description: "Wipe databases and auto-seed structured records (Admin only).",
    auth: "Admin"
  },
  {
    id: "system_status",
    category: "Administration",
    method: "GET",
    path: "/api/system/status",
    description: "Get real infrastructure status and database storage statistics.",
    auth: "None"
  }
];

interface APIExplorerProps {
  token: string | null;
  getAPIUrl: () => string;
}

interface EndpointState {
  status: number | null;
  time: number | null;
  lastResponse: any | null;
  loading: boolean;
  expanded: boolean;
  copied: boolean;
  body: string;
  pathParams: Record<string, string>;
}

export default function APIExplorer({ token, getAPIUrl }: APIExplorerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [states, setStates] = useState<Record<string, EndpointState>>(
    ENDPOINTS.reduce((acc, ep) => {
      acc[ep.id] = {
        status: null,
        time: null,
        lastResponse: null,
        loading: false,
        expanded: false,
        copied: false,
        body: ep.defaultBody || "",
        pathParams: ep.defaultPathParams || {}
      };
      return acc;
    }, {} as Record<string, EndpointState>)
  );

  const categories = ["All", "Authentication", "Jobs", "Candidates", "Ranking", "Copilot", "Administration"];

  const toggleExpand = (id: string) => {
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], expanded: !prev[id].expanded }
    }));
  };

  const updateParam = (id: string, key: string, val: string) => {
    setStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        pathParams: { ...prev[id].pathParams, [key]: val }
      }
    }));
  };

  const updateBody = (id: string, val: string) => {
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], body: val }
    }));
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setStates(prev => ({
      ...prev,
      [id]: { ...prev[id], copied: true }
    }));
    setTimeout(() => {
      setStates(prev => ({
        ...prev,
        [id]: { ...prev[id], copied: false }
      }));
    }, 2000);
  };

  const handleTest = async (ep: EndpointInfo) => {
    const state = states[ep.id];
    setStates(prev => ({
      ...prev,
      [ep.id]: { ...prev[ep.id], loading: true, status: null, time: null }
    }));

    const baseUrl = getAPIUrl();
    let finalPath = ep.path;

    // Substitute path params
    Object.entries(state.pathParams).forEach(([k, v]) => {
      finalPath = finalPath.replace(`{${k}}`, v);
    });

    let queryParams = "";
    if (ep.id === "compare") {
      const q = new URLSearchParams(state.pathParams);
      queryParams = `?${q.toString()}`;
      finalPath = "/api/rank/compare";
    }

    const url = `${baseUrl}${finalPath}${queryParams}`;
    const startTime = performance.now();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (ep.method !== "GET" && ep.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
    }

    try {
      const options: RequestInit = {
        method: ep.method,
        headers
      };

      if (ep.method !== "GET" && ep.method !== "DELETE" && state.body) {
        options.body = state.body;
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      let data;
      try {
        data = await res.json();
      } catch {
        data = { response: await res.text() };
      }

      setStates(prev => ({
        ...prev,
        [ep.id]: {
          ...prev[ep.id],
          loading: false,
          status: res.status,
          time: duration,
          lastResponse: data
        }
      }));
    } catch (err: any) {
      const endTime = performance.now();
      setStates(prev => ({
        ...prev,
        [ep.id]: {
          ...prev[ep.id],
          loading: false,
          status: 500,
          time: Math.round(endTime - startTime),
          lastResponse: { error: err.message || "Failed to establish connection to backend" }
        }
      }));
    }
  };

  const filteredEndpoints = activeCategory === "All" 
    ? ENDPOINTS 
    : ENDPOINTS.filter(ep => ep.category === activeCategory);

  const getMethodStyle = (method: string) => {
    switch (method) {
      case "GET": return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "POST": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "PUT": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "DELETE": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusColor = (status: number | null) => {
    if (status === null) return "text-slate-500";
    if (status >= 200 && status < 300) return "text-emerald-400 font-bold";
    if (status >= 400 && status < 500) return "text-amber-400 font-bold";
    return "text-rose-400 font-bold";
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto w-full overflow-hidden">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#242435] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400" /> Endpoint Explorer & Sandbox
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse active backend endpoints, inspect auth restrictions, and test real-time requests directly in the client sandbox.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-[#14141d] border border-[#242435] px-3.5 py-1.8 rounded-xl font-semibold">
          <Globe className="h-4 w-4 text-indigo-400" />
          <span className="text-slate-400">Target Host:</span>
          <span className="text-indigo-300 font-mono select-all">{getAPIUrl()}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/40 hide-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeCategory === cat 
                ? "bg-indigo-600/15 border border-indigo-500/35 text-indigo-400" 
                : "border border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3.5 overflow-y-auto flex-1 pr-1.5 min-h-[500px]">
        {filteredEndpoints.map(ep => {
          const state = states[ep.id];
          return (
            <div 
              key={ep.id} 
              className={`bg-[#14141d]/70 backdrop-blur-xs border transition-all rounded-2xl overflow-hidden ${
                state.expanded ? "border-indigo-500/40 shadow-lg shadow-indigo-600/5 bg-[#14141d]" : "border-[#242435] hover:border-slate-800"
              }`}
            >
              <div 
                onClick={() => toggleExpand(ep.id)}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-[10px] font-extrabold uppercase border rounded-lg tracking-wider shrink-0 ${getMethodStyle(ep.method)}`}>
                    {ep.method}
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                      <span className="font-mono">{ep.path}</span>
                      {ep.auth !== "None" && (
                        <span className="inline-flex items-center gap-1 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700 font-bold uppercase">
                          <Lock className="w-2.5 h-2.5" /> {ep.auth}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">{ep.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-[#242435] pt-3 md:pt-0">
                  <div className="text-right">
                    <span className="text-[9px] block text-slate-500 uppercase tracking-wider font-bold">Status</span>
                    <span className={`text-xs font-mono ${getStatusColor(state.status)}`}>
                      {state.status || "—"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] block text-slate-500 uppercase tracking-wider font-bold">Latency</span>
                    <span className="text-xs text-slate-300 font-mono">
                      {state.time !== null ? `${state.time}ms` : "—"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {state.expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {state.expanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-[#242435] bg-[#0d0d16]/30"
                  >
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
                      
                      <div className="space-y-4">
                        <h5 className="font-bold text-slate-300 tracking-wide uppercase text-[10px] border-b border-[#242435] pb-1.5">
                          Sandbox Request Parameters
                        </h5>

                        {Object.keys(state.pathParams).length > 0 && (
                          <div className="space-y-2.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Path Variables</label>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.keys(state.pathParams).map(key => (
                                <div key={key} className="space-y-1">
                                  <span className="text-[10px] font-mono text-indigo-400">{`{${key}}`}</span>
                                  <input
                                    type="text"
                                    value={state.pathParams[key]}
                                    onChange={(e) => updateParam(ep.id, key, e.target.value)}
                                    className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-3 py-1.5 rounded-lg text-xs font-mono text-slate-100"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ep.defaultBody !== undefined && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Request JSON Payload</label>
                            <textarea
                              value={state.body}
                              onChange={(e) => updateBody(ep.id, e.target.value)}
                              rows={6}
                              className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none p-3.5 rounded-xl text-xs font-mono text-slate-100 leading-relaxed resize-y"
                            />
                          </div>
                        )}

                        <button
                          onClick={() => handleTest(ep)}
                          disabled={state.loading}
                          className="bg-indigo-600 hover:bg-indigo-500 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                        >
                          {state.loading ? (
                            <>
                              <Activity className="h-4 w-4 animate-spin" />
                              Evaluating Route...
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" />
                              Send Sandbox Request
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-col min-h-[220px]">
                        <div className="flex justify-between items-baseline border-b border-[#242435] pb-1.5 mb-2.5">
                          <h5 className="font-bold text-slate-300 tracking-wide uppercase text-[10px]">
                            Response Payload Inspector
                          </h5>
                          {state.lastResponse && (
                            <button
                              onClick={() => copyToClipboard(ep.id, JSON.stringify(state.lastResponse, null, 2))}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1.5"
                            >
                              {state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              {state.copied ? "Copied" : "Copy Output"}
                            </button>
                          )}
                        </div>

                        {state.lastResponse ? (
                          <pre className="flex-1 w-full bg-[#0d0d16] p-4 rounded-xl border border-[#242435] text-[10px] font-mono text-indigo-200 overflow-auto whitespace-pre leading-relaxed max-h-[300px]">
                            {JSON.stringify(state.lastResponse, null, 2)}
                          </pre>
                        ) : (
                          <div className="flex-1 w-full bg-[#0d0d16]/50 border border-dashed border-[#242435] rounded-xl flex items-center justify-center text-slate-500 text-[11px] font-medium py-12 text-center px-4">
                            Send request to capture backend response headers & JSON body.
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
  );
}
