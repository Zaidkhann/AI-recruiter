"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Cpu,
  Sliders,
  UserCheck,
  Code,
  TrendingUp,
  Send,
  RefreshCw,
  Sparkles,
  Briefcase,
  AlertCircle,
  ChevronRight,
  X,
  Award,
  Mail,
  HelpCircle,
  HelpCircle as QuestionIcon,
  CheckCircle,
  MessageSquare,
  BarChart2,
  Upload,
  FileText,
  Terminal,
  Globe,
  LayoutDashboard
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { CandidateList } from "./components/candidates/CandidateList";
import ExecutiveSummaryCard from "./components/dashboard/ExecutiveSummaryCard";
import { PipelineVisualizer } from "./components/dashboard/PipelineVisualizer";
import { TeamHeatmap } from "./components/candidates/TeamHeatmap";
import JobManager from "./components/dashboard/JobManager";
import APIExplorer from "./components/dashboard/APIExplorer";
import { PipelineStory } from "./components/dashboard/PipelineStory";


export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [teamSkills, setTeamSkills] = useState<string[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState("YC_FOUNDING_ENGINEER");
  const [currentView, setCurrentView] = useState<"recruiter" | "admin" | "api">("recruiter");
  const [activeUploadSession, setActiveUploadSession] = useState<string | null>(null);
  
  // JWT Authentication States
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Security Audit Log States
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // System status states
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [showStatusPopover, setShowStatusPopover] = useState(false);

  // Scoring factor weights (0.0 to 1.0)
  const [weights, setWeights] = useState({
    semantic: 0.5,
    adjacency: 0.5,
    trajectory: 0.5,
    behavioral: 0.5,
    success: 0.5,
    learning: 0.5,
    market: 0.5,
    potential: 0.5
  });

  // UI Interactive States
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotHistory, setCopilotHistory] = useState([
    { role: "assistant", content: "Welcome! I am your AI Recruiter Copilot. Ask me to adjust search weights, compare profiles, or search candidates." }
  ]);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("debate");

  // Loading animations state
  const [isRanking, setIsRanking] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [isDebating, setIsDebating] = useState(false);
  const [debateHistory, setDebateHistory] = useState<any>([]);
  const [decisionCard, setDecisionCard] = useState<any>(null);
  const [copilotTyping, setCopilotTyping] = useState(false);

  // Chat window scroll ref
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getAPIUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  };

  const getAuthHeaders = (): Record<string, string> => {
    const savedToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    return savedToken ? { "Authorization": `Bearer ${savedToken}` } : {};
  };

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const u = customUser || loginUsername;
    const p = customPass || loginPassword;
    
    try {
      const res = await fetch(`${getAPIUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("role", data.role);
        setToken(data.access_token);
        setUsername(data.username);
        setRole(data.role);
        setLoginUsername("");
        setLoginPassword("");
        // Trigger initial data load
        setTimeout(() => {
          fetchInitialData();
        }, 100);
      } else {
        const err = await res.json().catch(() => ({ detail: "Invalid credentials" }));
        setLoginError(err.detail || "Authentication failed");
      }
    } catch (err) {
      setLoginError("Could not reach authentication server");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setToken(null);
    setUsername("");
    setRole("");
    setJobs([]);
    setCandidates([]);
    setSystemStatus(null);
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(`${getAPIUrl()}/api/admin/audit-logs`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const statusRes = await fetch(`${getAPIUrl()}/api/system/status`, {
        headers: getAuthHeaders()
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSystemStatus(statusData);
      } else {
        if (statusRes.status === 401) handleLogout();
        setSystemStatus({ mode: "offline" });
      }
    } catch (e) {
      setSystemStatus({ mode: "offline" });
    }
  };

  const fetchInitialData = async () => {
    try {
      const statusRes = await fetch(`${getAPIUrl()}/api/system/status`, {
        headers: getAuthHeaders()
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setSystemStatus(statusData);
      } else {
        if (statusRes.status === 401) {
          handleLogout();
          return;
        }
        setSystemStatus({ mode: "offline" });
        return;
      }

      // Fetch Jobs
      const jobsRes = await fetch(`${getAPIUrl()}/api/jobs`, {
        headers: getAuthHeaders()
      });
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
        if (jobsData.length > 0 && selectedJobId === null) {
          setSelectedJobId(jobsData[0].id);
        }
      }

      // Fetch Team Skills and Members
      const teamRes = await fetch(`${getAPIUrl()}/api/team`, {
        headers: getAuthHeaders()
      });
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
        const skillsSet = new Set<string>();
        teamData.forEach((m: any) => m.skills?.forEach((s: string) => skillsSet.add(s)));
        setTeamSkills(Array.from(skillsSet));
      }
    } catch (e) {
      setSystemStatus({ mode: "offline" });
    }
  };

  const fetchData = async () => {
    if (selectedJobId === null) return;
    setIsRanking(true);
    setRankingError(null);
    try {
      await fetchSystemStatus();
      await calculateRankings(weights, selectedBenchmark);
    } catch (e) {
      setSystemStatus({ mode: "offline" });
    } finally {
      setIsRanking(false);
    }
  };

  const calculateRankings = async (activeWeights: any, benchmarkProfile: string) => {
    if (selectedJobId === null) return;
    setIsRanking(true);
    setRankingError(null);
    try {
      const rankRes = await fetch(`${getAPIUrl()}/api/rank`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          job_id: selectedJobId,
          weights: activeWeights,
          benchmark_profile: benchmarkProfile
        })
      });
      if (rankRes.ok) {
        const rankData = await rankRes.json();
        setCandidates(rankData);
      } else {
        if (rankRes.status === 401) {
          handleLogout();
          return;
        }
        const errText = await rankRes.text().catch(() => "Failed compute rankings.");
        let errMsg = "Failed to calculate rankings.";
        try {
          const errObj = JSON.parse(errText);
          errMsg = errObj.detail || errMsg;
        } catch {
          errMsg = errText || errMsg;
        }
        setRankingError(errMsg);
      }
    } catch (e) {
      console.error("Error calculating rankings:", e);
      setRankingError("Connection error. Could not reach ranking API server.");
    } finally {
      setIsRanking(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    if (savedToken && savedUser && savedRole) {
      setToken(savedToken);
      setUsername(savedUser);
      setRole(savedRole);
      setTimeout(() => {
        fetchInitialData();
      }, 50);
    }
  }, []);

  useEffect(() => {
    if (selectedJobId !== null && token) {
      fetchData();
    }
  }, [selectedJobId, token]);

  useEffect(() => {
    if (!token) return;
    const statusInterval = setInterval(() => {
      fetchSystemStatus();
    }, 10000);
    return () => clearInterval(statusInterval);
  }, [token]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [copilotHistory]);

  const handleSliderChange = (factor: string, value: number) => {
    const newWeights = { ...weights, [factor]: value };
    setWeights(newWeights);
    calculateRankings(newWeights, selectedBenchmark);
  };

  const handleBenchmarkChange = (benchmark: string) => {
    setSelectedBenchmark(benchmark);
    calculateRankings(weights, benchmark);
  };

  const resetDatabase = async () => {
    setIsRanking(true);
    try {
      const res = await fetch(`${getAPIUrl()}/api/seed-db`, { 
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert("Database reset and seeded successfully!");
        fetchInitialData();
      } else {
        alert("Action forbidden: Insufficient privileges.");
      }
    } catch (e) {
      alert("Failed to reset database.");
    } finally {
      setIsRanking(false);
    }
  };

  const handleUploadCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) return;
    setUploadLoading(true);
    setUploadSuccess(null);
    setUploadError(null);
    setBatchResults(null);
    
    const sess = "session_" + Date.now();
    setActiveUploadSession(sess);
    
    const formData = new FormData();
    uploadFiles.forEach((file) => {
      formData.append("files", file);
    });
    
    try {
      const res = await fetch(`${getAPIUrl()}/api/candidates/upload-batch?session_id=${sess}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setBatchResults(data.results);
        if (data.error_count === 0) {
          setUploadSuccess(`Successfully uploaded ${data.success_count} resume${data.success_count > 1 ? 's' : ''}!`);
        } else if (data.success_count > 0) {
          setUploadSuccess(`Uploaded ${data.success_count} of ${data.total} resumes. ${data.error_count} failed.`);
        } else {
          setUploadError(`All ${data.total} uploads failed.`);
        }
        setUploadFiles([]);
        fetchData();
        fetchInitialData();
      } else {
        const errObj = await res.json().catch(() => ({ detail: "Ingestion failed" }));
        setUploadError(errObj.detail || "Failed to upload and parse candidates.");
        setActiveUploadSession(null);
      }
    } catch (err) {
      setUploadError("Could not reach candidate ingestion server.");
      setActiveUploadSession(null);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const allowed = [".pdf", ".docx", ".txt"];
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return allowed.includes(ext);
    });
    if (droppedFiles.length > 0) {
      setUploadFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const newFiles = droppedFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
      setUploadSuccess(null);
      setUploadError(null);
      setBatchResults(null);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotPrompt.trim() || selectedJobId === null) return;

    const userText = copilotPrompt;
    setCopilotPrompt("");
    setCopilotHistory(prev => [...prev, { role: "user", content: userText }]);
    setCopilotTyping(true);

    try {
      const res = await fetch(`${getAPIUrl()}/api/copilot`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          session_id: "demo-session-id",
          job_id: selectedJobId,
          prompt: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCopilotHistory(prev => [...prev, { role: "assistant", content: data.answer }]);
        if (data.weight_adjustments) {
          const mergedWeights = { ...weights, ...data.weight_adjustments };
          setWeights(mergedWeights);
          calculateRankings(mergedWeights, selectedBenchmark);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.detail || "LLM service is currently unavailable. Copilot adjustment failed.";
        setCopilotHistory(prev => [...prev, { role: "assistant", content: errMsg }]);
      }
    } catch (e) {
      setCopilotHistory(prev => [...prev, { role: "assistant", content: "LLM service is currently unavailable. Connection failed." }]);
    } finally {
      setCopilotTyping(false);
    }
  };

  const selectCandidateForDetail = async (cand: any) => {
    if (selectedJobId === null) return;
    setSelectedCandidate(cand);
    setDebateHistory([]);
    setDecisionCard(null);
    setActiveTab("debate");
    setIsDebating(true);

    try {
      const res = await fetch(`${getAPIUrl()}/api/rank/${selectedJobId}/candidate/${cand.id}/decision`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDebateHistory(data.debate);
        setDecisionCard(data);
      } else {
        setDebateHistory({ status: "unavailable", reason: "API response error" });
        setDecisionCard({ status: "unavailable", reason: "API response error" });
      }
    } catch (e) {
      setDebateHistory({ status: "unavailable", reason: "Connection failed" });
      setDecisionCard({ status: "unavailable", reason: "Connection failed" });
    } finally {
      setIsDebating(false);
    }
  };



  // Convert candidate factors object into chart array format
  const getRadarData = (cand: any) => {
    if (!cand || !cand.factors) return [];
    return [
      { subject: "Semantic Fit", score: cand.factors.semantic * 100 },
      { subject: "Skill Adjacency", score: cand.factors.adjacency * 100 },
      { subject: "Career Velocity", score: cand.factors.trajectory * 100 },
      { subject: "GitHub Activity", score: cand.factors.behavioral * 100 },
      { subject: "Tenure Stability", score: cand.factors.success * 100 },
      { subject: "Learning Velocity", score: cand.factors.learning * 100 },
      { subject: "Market Trend", score: cand.factors.market * 100 },
      { subject: "Future Potential", score: cand.factors.potential * 100 }
    ];
  };

  // Build Team Gap visualization details
  const getTeamGapData = (cand: any) => {
    if (!cand) return [];
    const jobSelected = jobs.find(j => j.id === selectedJobId) || jobs[0];
    if (!jobSelected) return [];
    const reqSkills = jobSelected.graph_schema?.skills_required || [];

    return reqSkills.map((skill: string) => {
      const presentInTeam = teamSkills.map(s => s.toLowerCase()).includes(skill.toLowerCase());
      const presentInCandidate = cand.skills.map((s: string) => s.toLowerCase()).includes(skill.toLowerCase());

      return {
        skill: skill,
        "Team Has Skill": presentInTeam ? 100 : 0,
        "Candidate Has Skill": presentInCandidate ? 100 : 0,
        gapFilled: !presentInTeam && presentInCandidate
      };
    });
  };

  const activeJob = jobs.find(j => j.id === selectedJobId) || jobs[0] || { id: null, title: "No Role Active", graph_schema: { skills_required: [] } };

  const gapsIdentified = activeJob?.graph_schema?.skills_required?.filter(
    (s: string) => !teamSkills.map(ts => ts.toLowerCase()).includes(s.toLowerCase())
  ) || [];

  // Return login screen if session is not authenticated
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#09090c] text-slate-100 font-sans p-6">
        <div className="w-full max-w-md bg-[#14141d]/80 backdrop-blur-md border border-[#242435] rounded-2xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div className="text-center space-y-2">
            <div className="bg-indigo-600/10 p-3 rounded-full text-indigo-400 inline-block">
              <Cpu className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Antigravity AI Recruiter</h2>
            <p className="text-xs text-slate-400">Complete Security Hardening Active</p>
          </div>
          
          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-4 py-2.5 rounded-xl text-xs text-slate-100"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0d0d16] border border-[#242435] focus:border-indigo-500 focus:outline-none px-4 py-2.5 rounded-xl text-xs text-slate-100"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-50 mt-2"
            >
              {loginLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : "Authenticate Session"}
            </button>
          </form>
          
          <div className="border-t border-[#242435] pt-4 mt-4 space-y-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">Quick Developer Access</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleLogin(undefined, "admin", "admin123")}
                className="bg-[#1b1b2a] hover:bg-indigo-600/20 border border-slate-700/60 py-2 rounded-xl text-[10px] font-semibold text-slate-200 transition-all active:scale-95 hover:border-indigo-500/50"
              >
                Admin
              </button>
              <button
                onClick={() => handleLogin(undefined, "recruiter", "recruiter123")}
                className="bg-[#1b1b2a] hover:bg-purple-600/20 border border-slate-700/60 py-2 rounded-xl text-[10px] font-semibold text-slate-200 transition-all active:scale-95 hover:border-purple-500/50"
              >
                Recruiter
              </button>
              <button
                onClick={() => handleLogin(undefined, "viewer", "viewer123")}
                className="bg-[#1b1b2a] hover:bg-emerald-600/20 border border-slate-700/60 py-2 rounded-xl text-[10px] font-semibold text-slate-200 transition-all active:scale-95 hover:border-emerald-500/50"
              >
                Viewer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Return offline fallback interface if server cannot be reached
  if (systemStatus?.mode === "offline") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090c] text-slate-100 font-sans p-6 text-center">
        <div className="max-w-md bg-[#14141d] border border-[#242435] rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="bg-rose-500/10 p-4 rounded-full text-rose-400 inline-block">
            <AlertCircle className="h-10 w-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Backend Offline</h2>
            <p className="text-sm text-slate-400">
              The AI Recruiter API is unreachable at <span className="font-mono text-rose-300">{getAPIUrl()}</span>.
            </p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-left space-y-3 font-mono text-xs">
            <p className="text-slate-400"># Start your backend server:</p>
            <p className="text-indigo-400">uvicorn app.main:app --reload --port 8000</p>
          </div>
          <button
            onClick={() => {
              setSystemStatus(null);
              fetchInitialData();
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Try Reconnecting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#09090c] text-slate-100 font-sans min-h-screen">

      {/* --- HEADER --- */}
      <header className="border-b border-[#242435] bg-[#0d0d16] px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-lg flex items-center justify-center text-white shadow-indigo-500/20 shadow-md">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Antigravity <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">AI Architect</span>
            </h1>
            <p className="text-xs text-slate-400">Candidate Intelligence & Decision Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Infrastructure Resiliency Widget */}
          {systemStatus && (
            <div className="relative">
              <button
                onClick={() => setShowStatusPopover(!showStatusPopover)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-slate-800 ${
                  systemStatus.mode === "fallback"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${
                  systemStatus.mode === "fallback" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`}></span>
                System Status: {systemStatus.mode === "fallback" ? "Fallback" : "Live"}
              </button>

              {showStatusPopover && (
                <div className="absolute right-0 mt-2 w-64 bg-[#11111b] border border-[#242435] rounded-xl p-4 shadow-2xl z-50 animate-fade-in text-xs space-y-2.5">
                  <h4 className="font-bold text-white border-b border-[#242435] pb-1.5 flex items-center justify-between">
                    <span>System Status</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full uppercase ${
                      systemStatus.mode === "fallback" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {systemStatus.mode}
                    </span>
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Database:</span>
                      <span className="font-semibold text-white uppercase">{systemStatus.database}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cache:</span>
                      <span className="font-semibold text-white uppercase">{systemStatus.cache}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vector:</span>
                      <span className="font-semibold text-white uppercase">{systemStatus.vector}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">LLM:</span>
                      <span className={`font-semibold uppercase ${systemStatus.llm === "connected" ? "text-indigo-400" : "text-rose-400"}`}>
                        {systemStatus.llm === "connected" ? "Gemini" : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#242435] pt-1.5 mt-1.5">
                      <span className="text-slate-400">Mode:</span>
                      <span className="font-bold text-white uppercase">{systemStatus.mode === "fallback" ? "Fallback" : "Live"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {jobs.length > 0 && (
            <div className="flex items-center gap-2 bg-[#14141d] border border-[#242435] px-3 py-1.5 rounded-lg">
              <Briefcase className="h-4 w-4 text-indigo-400" />
              <span className="text-xs text-slate-400 font-semibold">Active Role:</span>
              <select
                className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer border-none p-0 font-medium"
                value={selectedJobId || ""}
                onChange={(e) => setSelectedJobId(Number(e.target.value))}
              >
                {jobs.map(j => (
                  <option key={j.id} value={j.id} className="bg-[#14141d]">{j.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Authenticated User Session Profile */}
          <div className="flex items-center gap-3 bg-[#14141d] border border-[#242435] px-3 py-1.5 rounded-lg text-xs">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-slate-400">User:</span>
            <span className="font-semibold text-white">{username}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full uppercase font-bold border ${
              role === 'admin' 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                : role === 'recruiter' 
                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {role}
            </span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 ml-2 font-semibold transition-colors"
            >
              Logout
            </button>
          </div>

          {role === "admin" && (
            <>
              <button
                onClick={() => {
                  setShowAuditLogs(true);
                  fetchAuditLogs();
                }}
                className="flex items-center gap-2 bg-[#1b1b2a] hover:bg-slate-800 border border-slate-700 px-3.5 py-1.8 rounded-lg text-xs font-semibold text-slate-300 transition-all active:scale-95 shadow-inner"
              >
                <BarChart2 className="h-3.5 w-3.5 text-rose-400" />
                Audit Logs
              </button>

              <button
                onClick={resetDatabase}
                className="flex items-center gap-2 bg-[#1b1b2a] hover:bg-slate-800 border border-slate-700 px-3.5 py-1.8 rounded-lg text-xs font-semibold text-slate-300 transition-all active:scale-95 shadow-inner"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset & Seed Data
              </button>
            </>
          )}
        </div>
      </header>

      {/* --- TOP-LEVEL VIEW NAVIGATION --- */}
      <nav className="border-b border-[#242435] bg-[#0d0d16]/60 backdrop-blur-sm px-6">
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: "recruiter" as const, label: "Recruiter Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
            { id: "admin" as const, label: "Job Management", icon: <Briefcase className="h-3.5 w-3.5" /> },
            { id: "api" as const, label: "API Explorer", icon: <Terminal className="h-3.5 w-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                currentView === tab.id
                  ? "border-indigo-500 text-indigo-400 bg-indigo-600/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* --- CONDITIONAL VIEW RENDERING --- */}

      {/* API EXPLORER VIEW */}
      {currentView === "api" && (
        <div className="flex-1 overflow-y-auto">
          <APIExplorer token={token} getAPIUrl={getAPIUrl} />
        </div>
      )}

      {/* JOB MANAGEMENT VIEW */}
      {currentView === "admin" && (
        <div className="flex-1 overflow-y-auto">
          <JobManager
            token={token}
            role={role}
            getAPIUrl={getAPIUrl}
            onActiveJobChanged={(jobId: number) => setSelectedJobId(jobId)}
            selectedJobId={selectedJobId}
          />
        </div>
      )}

      {/* RECRUITER DASHBOARD VIEW */}
      {currentView === "recruiter" && (<>

      {/* --- EXECUTIVE ROI ANALYTICS ROW --- */}
      <section className="px-6 pt-5 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Ranked Candidates</p>
            <h3 className="text-2xl font-bold text-white mt-1">{candidates.length} Profiles</h3>
            <p className="text-[10px] text-slate-400 mt-1">Matched to the active job description</p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Active Job Roles</p>
            <h3 className="text-2xl font-bold text-white mt-1">{jobs.length} Roles</h3>
            <p className="text-[10px] text-slate-400 mt-1">Available in database registry</p>
          </div>
          <div className="bg-indigo-500/10 p-3 rounded-lg text-indigo-400">
            <Briefcase className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Active Team Skill Gaps</p>
            <h3 className="text-2xl font-bold text-white mt-1">{gapsIdentified.length} Detected</h3>
            <p className="text-[10px] text-yellow-400 mt-1">
              {gapsIdentified.length > 0
                ? `Missing: ${gapsIdentified.slice(0, 3).join(", ")}${gapsIdentified.length > 3 ? "..." : ""}`
                : "All required skills present in team"}
            </p>
          </div>
          <div className="bg-yellow-500/10 p-3 rounded-lg text-yellow-400">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-[#14141d] border border-[#242435] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Evaluated Profiles</p>
            <h3 className="text-2xl font-bold text-white mt-1">{systemStatus?.candidates || 0} Resumes</h3>
            <p className="text-[10px] text-slate-400 mt-1">Twin-Graph node mappings complete</p>
          </div>
          <div className="bg-purple-500/10 p-3 rounded-lg text-purple-400">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </section>

      {/* --- MAIN DASHBOARD LAYOUT --- */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 min-h-0">
        
        {/* EXECUTIVE SUMMARY BARS */}
        {candidates.length > 0 && selectedJobId !== null && (
          <div className="lg:col-span-12 flex flex-col gap-5">
            <ExecutiveSummaryCard candidate={candidates[0]} jobId={selectedJobId} />
            <PipelineVisualizer />
          </div>
        )}

        {/* --- LEFT COLUMN: CONTROLS & COPILOT --- */}
        <section className="lg:col-span-5 flex flex-col gap-5 min-h-0">

          {/* RESUME INGESTION UPLOADER */}
          <div className="bg-[#14141d] border border-[#242435] rounded-2xl p-5 flex flex-col shadow-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-slate-200">
              <Upload className="h-4 w-4 text-indigo-400" /> Resume Ingestion
            </h3>

            {role === "viewer" ? (
              <div className="bg-[#1b1b2a]/40 border border-[#242435] rounded-xl p-4 flex flex-col items-center justify-center text-center text-slate-400 gap-2.5 py-6">
                <div className="bg-slate-800/50 p-2 rounded-full text-slate-500">
                  <X className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">View-Only Access</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[220px]">
                    Your role (viewer) does not have privileges to ingest resumes. Log in as a Recruiter or Admin to upload candidate files.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadCandidate} className="space-y-3">
                {uploadSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-start gap-2 animate-fade-in">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}
                {uploadError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-xs flex items-start gap-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Batch Results Detail */}
                {batchResults && batchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                    {batchResults.map((r: any, i: number) => (
                      <div key={i} className={`flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border ${
                        r.status === 'success'
                          ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/5 border-rose-500/15 text-rose-400'
                      }`}>
                        {r.status === 'success' ? (
                          <CheckCircle className="h-3 w-3 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate font-medium">{r.filename}</span>
                        <span className="ml-auto text-[10px] opacity-70 shrink-0">
                          {r.status === 'success' ? r.name : r.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`group relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-300 ${
                    dragActive
                      ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02] shadow-lg shadow-indigo-500/10'
                      : 'border-[#242435] hover:border-indigo-500/50 bg-[#0d0d16]/30 hover:bg-[#0d0d16]/50'
                  }`}
                >
                  <input
                    type="file"
                    id="resume-file-input"
                    accept=".pdf,.docx,.txt"
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const newFiles = Array.from(e.target.files);
                        setUploadFiles(prev => {
                          const existingNames = new Set(prev.map(f => f.name));
                          const filtered = newFiles.filter(f => !existingNames.has(f.name));
                          return [...prev, ...filtered];
                        });
                        setUploadSuccess(null);
                        setUploadError(null);
                        setBatchResults(null);
                        // Reset file input so same files can be re-selected
                        e.target.value = '';
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center gap-2.5 pointer-events-none">
                    <div className={`p-3 rounded-xl transition-all duration-300 ${
                      dragActive
                        ? 'bg-indigo-500/20 text-indigo-300 scale-110'
                        : 'bg-indigo-500/5 text-indigo-400 group-hover:bg-indigo-500/10'
                    }`}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-300">
                        {dragActive ? 'Drop resumes here...' : 'Drag & drop resumes here'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        or click to browse • PDF, DOCX, TXT • up to 5MB each • multiple files
                      </p>
                    </div>
                  </div>
                </div>

                {/* File List */}
                {uploadFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected
                      </p>
                      <button
                        type="button"
                        onClick={() => setUploadFiles([])}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="max-h-[130px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {uploadFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 bg-[#1b1b2a]/60 border border-[#242435] rounded-lg px-3 py-1.5 group/file hover:border-indigo-500/30 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span className="text-[11px] text-slate-300 truncate flex-1 font-medium">
                            {file.name}
                          </span>
                          <span className="text-[9px] text-slate-500 shrink-0">
                            {(file.size / 1024).toFixed(0)}KB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all opacity-0 group-hover/file:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadFiles.length > 0 && (
                  <button
                    type="submit"
                    disabled={uploadLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-50"
                  >
                    {uploadLoading ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing {uploadFiles.length} resume{uploadFiles.length > 1 ? 's' : ''}...</>
                    ) : (
                      <><Upload className="h-3.5 w-3.5" /> Ingest & Parse {uploadFiles.length} Resume{uploadFiles.length > 1 ? 's' : ''}</>
                    )}
                  </button>
                )}
              </form>
            )}
          </div>

          {/* AI COPILOT CHAT BOX */}
          <div className="bg-[#14141d] border border-[#242435] rounded-2xl flex flex-col flex-1 shadow-md overflow-hidden min-h-[300px]">
            <div className="bg-[#191928] border-b border-[#242435] px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
                <Sparkles className="h-4 w-4" /> Recruiter AI Copilot
              </span>
              <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">AGENT ACTIVE</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {copilotHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 shadow ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#1b1b2a] border border-[#242435] text-slate-200 rounded-bl-none'}`}>
                    {msg.content}
                    {msg.role === 'assistant' && (msg as any).adjustments && (
                      <div className="mt-2 pt-2 border-t border-[#2e2e45] flex flex-wrap gap-1">
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">Scoring weights re-aligned</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {copilotTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e2d] border border-[#2e2e45] text-slate-400 rounded-xl rounded-bl-none p-3 flex items-center gap-1.5">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce [animation-delay:0.2s]">●</span>
                    <span className="animate-bounce [animation-delay:0.4s]">●</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Suggestion Chips */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar border-t border-[#242435] bg-[#0d0d16]/50">
               {["Why is Candidate A ranked #1?", "Compare top 3 candidates", "What skills are missing?", "Who is most startup-ready?"].map((chip, idx) => (
                 <button key={idx} onClick={() => setCopilotPrompt(chip)} className="bg-[#1b1b2a] hover:bg-[#242435] border border-[#3e3e57] text-[10px] text-slate-300 px-3 py-1.5 rounded-full transition-colors shrink-0">
                   {chip}
                 </button>
               ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={submitCopilot} className="p-3 border-t border-[#242435] flex items-center gap-2 bg-[#0d0d16]">
              <input
                type="text"
                value={copilotPrompt}
                disabled={role === "viewer"}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder={role === "viewer" ? "Requires Recruiter role to query Copilot" : "Ask Copilot (e.g. 'find candidates who learn fast')..."}
                className="flex-1 bg-[#14141d] border border-[#242435] focus:border-indigo-500 focus:outline-none px-3.5 py-2 rounded-xl text-xs text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={role === "viewer" || copilotTyping}
                className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-xl text-white transition-all active:scale-95 flex items-center justify-center shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* MULTI-FACTOR WEIGHT ADJUSTER */}
          <div className="bg-[#14141d] border border-[#242435] rounded-2xl p-5 flex flex-col shadow-md">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-slate-200">
              <Sliders className="h-4 w-4 text-indigo-400" /> Multi-Factor Rank Tuning
            </h3>

            {/* Target Benchmark Dropdown */}
            <div className="mb-4 flex items-center justify-between bg-[#191928] border border-[#242435] rounded-xl px-3.5 py-2">
              <span className="text-xs text-slate-400 font-semibold">Benchmark Overlay:</span>
              <select
                className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer border-none"
                value={selectedBenchmark}
                onChange={(e) => handleBenchmarkChange(e.target.value)}
              >
                <option value="DEFAULT" className="bg-[#14141d] text-slate-300">Default Balanced Profile</option>
                <option value="YC_FOUNDING_ENGINEER" className="bg-[#14141d] text-slate-300">YC Founding Engineer Bar</option>
                <option value="FAANG_STAFF" className="bg-[#14141d] text-slate-300">FAANG Staff Engineer Bar</option>
              </select>
            </div>

            {/* Slider Controls */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              {Object.keys(weights).map((key) => {
                const labelMap: any = {
                  semantic: "Semantic Fit",
                  adjacency: "Skill Adjacency",
                  trajectory: "Career Velocity",
                  behavioral: "GitHub Activity",
                  success: "Tenure Stability",
                  learning: "Learning Velocity",
                  market: "Market Trend",
                  potential: "Future Potential"
                };

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-medium">{labelMap[key]}</span>
                      <span className="text-indigo-400 font-bold">{(weights as any)[key].toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={(weights as any)[key]}
                      onChange={(e) => handleSliderChange(key, Number(e.target.value))}
                      className="w-full h-1 bg-[#242435] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* --- RIGHT COLUMN: PIPELINE & CANDIDATES --- */}
        <section className="lg:col-span-7 bg-[#14141d] border border-[#242435] rounded-2xl p-5 shadow-md flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#242435] pb-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hiring Pipeline for: <span className="text-indigo-300 font-semibold">{activeJob.title}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Showing ranked candidates based on active weights.</p>
            </div>

            {isRanking && (
              <span className="text-xs text-indigo-400 flex items-center gap-2 animate-pulse font-medium">
                <RefreshCw className="h-3 w-3 animate-spin" /> Recalculating...
              </span>
            )}
          </div>

          {/* Candidate list wrapper */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 flex flex-col min-h-0">
            {rankingError ? (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 flex gap-3.5 text-rose-400 text-xs items-start">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Ranking Computation Error</p>
                  <p className="mt-1.5 text-slate-300 leading-relaxed">{rankingError}</p>
                  <button
                    onClick={() => calculateRankings(weights, selectedBenchmark)}
                    className="mt-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3.5 py-2 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all active:scale-95 shadow-sm"
                  >
                    Retry Ranking Query
                  </button>
                </div>
              </div>
            ) : isRanking && candidates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-xs gap-3">
                <RefreshCw className="h-7 w-7 text-indigo-500 animate-spin" />
                <span>Computing candidate scores across 8 vectors...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400 text-xs text-center p-6 border border-dashed border-[#242435] rounded-2xl">
                <Users className="h-10 w-10 text-slate-500 mb-2" />
                <p className="font-semibold text-slate-300 text-sm">No Candidates Evaluated</p>
                <p className="text-slate-500 mt-1 max-w-xs leading-relaxed">
                  Trigger a database seed by clicking the &quot;Reset &amp; Seed Data&quot; button or add candidate records using the backend endpoint.
                </p>
              </div>
            ) : (
              candidates.map((cand) => {
                const matchesBenchmark = cand.final_score > 0.85;
                const matchesYC = cand.final_score > 0.90;
                const hasGap = cand.modifiers.team_gap_score > 0.5;

                return (
                  <div
                    key={cand.id}
                    onClick={() => selectCandidateForDetail(cand)}
                    className={`bg-[#1e1e2d]/60 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-all hover:bg-[#232338] group ${selectedCandidate?.id === cand.id ? 'border-indigo-500 shadow-md bg-[#232338]' : 'border-[#242435]'
                      }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank Circle */}
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shadow ${cand.rank === 1
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40'
                        : cand.rank === 2
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                          : 'bg-slate-700/20 text-slate-400 border border-slate-700/40'
                        }`}>
                        #{cand.rank}
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {cand.name}
                        </h4>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Code className="h-3.5 w-3.5 text-indigo-400" /> github: {cand.github_username}
                        </p>

                        {/* Skill tags */}
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {cand.skills.slice(0, 4).map((s: string, i: number) => (
                            <span key={i} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700/30 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                          {cand.skills.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-semibold pl-1">+{cand.skills.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 md:mt-0 justify-between md:justify-end border-t md:border-t-0 border-[#242435] pt-3 md:pt-0">
                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {cand.is_llm_verified && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 px-2 py-0.5 rounded">
                            LLM Reranked
                          </span>
                        )}
                        {hasGap && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 px-2 py-0.5 rounded">
                            Gap Filler
                          </span>
                        )}
                        {cand.modifiers.transferable_skills > 0.1 && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30 px-2 py-0.5 rounded">
                            Hidden Talent
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-medium">Match Score</div>
                        <div className="text-base font-extrabold text-indigo-400 flex items-center gap-1.5 justify-end">
                          {Math.round(cand.final_score * 100)}%
                          <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* --- SLIDE-OUT CANDIDATE DETAIL DRAWER --- */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
          <div className="w-full max-w-2xl bg-[#0c0c14] border-l border-[#242435] h-full shadow-2xl flex flex-col animate-fade-in">

            {/* Drawer Header */}
            <div className="p-5 border-b border-[#242435] flex items-center justify-between bg-[#11111b]">
              <div>
                <span className="text-[10px] bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Rank #{selectedCandidate.rank}
                </span>
                <h3 className="text-lg font-bold text-white mt-2">{selectedCandidate.name}</h3>
                <p className="text-xs text-slate-400">{selectedCandidate.email} • GitHub: {selectedCandidate.github_username}</p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="border-b border-[#242435] bg-[#0c0c14] flex px-4">
              <button
                onClick={() => setActiveTab("debate")}
                className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 ${activeTab === "debate"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                Agentic Committee Debate
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 ${activeTab === "analytics"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                Graph & Score Analytics
              </button>
              <button
                onClick={() => setActiveTab("decision")}
                className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 ${activeTab === "decision"
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
              >
                Decision Card & Actions
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* TAB 1: AGENTIC COMMITTEE DEBATE */}
              {activeTab === "debate" && (
                <div className="space-y-4">
                  <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Autonomous Hiring Debate</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Three specialized AI agents convene to debate this candidate&apos;s fit relative to the team&apos;s graph gaps and target job role parameters.
                      </p>
                    </div>
                  </div>

                  {isDebating ? (
                    <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
                      Committee agents are reviewing work history & GitHub commits...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.isArray(debateHistory) ? (
                        debateHistory.map((turn: any, i: number) => {
                          const isTL = turn.speaker === "Tech Lead";
                          const isPM = turn.speaker === "Product Manager";

                          return (
                            <div key={i} className="flex gap-3.5 bg-[#14141d] border border-[#242435] rounded-xl p-4 animate-fade-in">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow ${isTL
                                ? "bg-blue-600/20 text-blue-400"
                                : isPM
                                  ? "bg-amber-600/20 text-amber-400"
                                  : "bg-purple-600/20 text-purple-400"
                                }`}>
                                {turn.speaker[0]}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">{turn.speaker} Agent</span>
                                  <span className={`text-[9px] px-2 py-0.2 rounded-full uppercase border ${turn.tone === "enthusiastic"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : turn.tone === "skeptical"
                                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                    }`}>
                                    {turn.tone}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{turn.message}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-400 text-xs font-semibold">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          Hiring committee debate is unavailable because the LLM service is offline or Gemini API Key is missing.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SCORE & GRAPH ANALYTICS */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  {/* Radar Chart */}
                  <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <BarChart2 className="h-4 w-4 text-indigo-400" /> Multi-Factor Score Distribution
                    </h4>
                    <div className="h-64 w-full">
                      {mounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData(selectedCandidate)}>
                            <PolarGrid stroke="#242435" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 8 }} />
                            <Radar name={selectedCandidate.name} dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                          </RadarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Team Gaps Visualizer */}
                  <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-400" /> Team Skill Gap Solver Analysis
                    </h4>
                    <div className="h-52 w-full">
                      {mounted && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getTeamGapData(selectedCandidate)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="skill" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tick={false} />
                            <Tooltip contentStyle={{ backgroundColor: "#14141d", borderColor: "#242435" }} />
                            <Bar dataKey="Team Has Skill" fill="#3e3e57" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Candidate Has Skill" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="flex gap-4 mt-3 justify-center text-[10px] text-slate-400 font-semibold">
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#3e3e57] rounded-full"></span> Team Has Skill</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 bg-[#10b981] rounded-full"></span> Candidate Has Skill</div>
                    </div>
                  </div>

                  <TeamHeatmap
                    candidateSkills={selectedCandidate.skills || []}
                    requiredSkills={activeJob?.graph_schema?.required_skills || activeJob?.graph_schema?.skills_required || []}
                    teamSkills={teamSkills || []}
                  />
                </div>
              )}

              {/* TAB 3: DECISION CARD & ACTIONS */}
              {activeTab === "decision" && decisionCard && (
                decisionCard.status === "unavailable" ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-400 text-xs font-semibold">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    Decision intelligence card is unavailable because the LLM service is offline or Gemini API Key is missing.
                  </div>
                ) : (
                  <div className="space-y-6">

                    {/* Strengths & Gaps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2.5">
                        <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4" /> Evidence Strengths
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {decisionCard.strengths?.map((str: string, idx: number) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-emerald-500">•</span> {str}
                            </li>
                          )) || <p className="text-xs text-slate-500">No strengths data available.</p>}
                        </ul>
                      </div>

                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2.5">
                        <h5 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4" /> Gaps & Risks
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {decisionCard.risks?.map((risk: string, idx: number) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-rose-500">•</span> {risk}
                            </li>
                          )) || <p className="text-xs text-slate-500">No risks data available.</p>}
                        </ul>
                      </div>
                    </div>

                    {/* Suggested Interview Questions */}
                    <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <QuestionIcon className="h-4 w-4 text-indigo-400" /> Customized Interview Prep
                      </h4>
                      <div className="space-y-4">
                        {decisionCard.interview_questions?.map((q: any, idx: number) => (
                          <div key={idx} className="border-l-2 border-indigo-500 pl-4 space-y-1.5">
                            <p className="text-xs font-bold text-slate-100">{q.question}</p>
                            <p className="text-[10px] text-indigo-300"><span className="font-bold">Rationale:</span> {q.rationale}</p>
                            <p className="text-[10px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800"><span className="font-bold text-slate-300">Expected Answer Focus:</span> {q.expected_ideal_answer}</p>
                          </div>
                        )) || <p className="text-xs text-slate-500">No interview prep questions available.</p>}
                      </div>
                    </div>

                    {/* Hyper-personalized email outreach */}
                    <div className="bg-[#14141d] border border-[#242435] rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-indigo-400" /> Executive Outreach Draft
                        </h4>
                        {decisionCard.outreach_email && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(decisionCard.outreach_email);
                              alert("Email draft copied to clipboard!");
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                          >
                            Copy Draft
                          </button>
                        )}
                      </div>
                      <pre className="text-xs text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-900 whitespace-pre-wrap font-mono leading-relaxed">
                        {decisionCard.outreach_email || "No outreach draft available."}
                      </pre>
                    </div>

                  </div>
                )
              )}

            </div>
          </div>
        </div>
      )}

      </>)}{/* END currentView === "recruiter" */}

    </div>
  );
}
