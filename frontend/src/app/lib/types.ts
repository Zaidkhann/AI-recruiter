// ────────────────────────────────────────────────────
//  Centralized TypeScript types for the AI Recruiter
// ────────────────────────────────────────────────────

export interface Job {
  id: number;
  title: string;
  description: string;
  status: string;
  benchmark_profile: string;
  graph_schema: {
    skills_required?: string[];
    experience_level?: string;
    domains?: string[];
    key_requirements?: string[];
    inferred_prerequisites?: string[];
  } | null;
  created_at: string;
}

export interface Candidate {
  rank: number;
  id: number;
  name: string;
  email: string;
  skills: string[];
  github_username: string | null;
  final_score: number;
  raw_score: number;
  factors: RankingFactors;
  modifiers: RankingModifiers;
  trajectory_details: TrajectoryDetails;
  behavioral_details: BehavioralDetails;
  success_details: SuccessDetails;
  market_details: MarketDetails;
  is_llm_verified: boolean;
  phone?: string;
  location?: string;
  education?: Education[];
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  personal_website?: string;
  twitter_x?: string;
  behavioral_profile?: BehavioralDetails;
  overall_score?: number;
  confidence_score?: number;
  factor_breakdown?: Record<string, number>;
  explanation?: any;
  linkedin_intelligence?: LinkedInIntelligence;
  benchmark_data?: BenchmarkData;
  ranking_audit?: RankingAudit;
}

export interface RankingFactors {
  semantic: number;
  adjacency: number;
  trajectory: number;
  behavioral: number;
  success: number;
  learning: number;
  market: number;
  potential: number;
}

export interface RankingModifiers {
  team_gap_score: number;
  transferable_skills: number;
  benchmark_compatibility: number;
}

export interface TrajectoryDetails {
  promo_velocity: number;
  stability_score: number;
  level_alignment: number;
  overall: number;
}

export interface BehavioralDetails {
  behavioral_score: number;
  collaboration_score: number;
  engineering_maturity: number;
  technical_depth: number;
  startup_readiness: number;
  open_source_influence: number;
  community_impact: number;
  overall: number;
  commit_cadence?: number;
  collaboration?: number;
  project_complexity?: number;
}

export interface SuccessDetails {
  retention_prediction: number;
  promotion_prediction: number;
  success_probability: number;
  leadership_potential: number;
  growth_trajectory: number;
}

export interface MarketDetails {
  learning_velocity: number;
  market_score: number;
}

export interface Education {
  school: string;
  degree?: string;
  field_of_study?: string;
  graduation_year?: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  skills: string[];
}

export interface SystemStatus {
  mode: "live" | "fallback" | "offline";
  database: string;
  cache: string;
  vector: string;
  llm: string;
  candidates: number;
  jobs: number;
}

export interface RankingWeights {
  semantic: number;
  adjacency: number;
  trajectory: number;
  behavioral: number;
  success: number;
  learning: number;
  market: number;
  potential: number;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  adjustments?: Partial<RankingWeights>;
}

export interface DecisionData {
  status?: string;
  debate: DebateTurn[] | { status: string; reason: string };
  strengths: string[];
  risks: string[];
  interview_questions: InterviewQuestion[];
  outreach_email: string;
}

export interface DebateTurn {
  speaker: string;
  message: string;
  tone: "enthusiastic" | "skeptical" | "analytical";
}

export interface InterviewQuestion {
  question: string;
  rationale: string;
  expected_ideal_answer: string;
}

// ── GitHub Intelligence Types ──

export interface GitHubProfile {
  username: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  account_age_days: number;
  avatar_url: string;
}

export interface GitHubRepoAnalysis {
  total_count: number;
  total_stars: number;
  total_forks: number;
  total_watchers: number;
  original_repos: number;
  forked_repos: number;
  topics: string[];
  has_readme_ratio: number;
  has_license_ratio: number;
  avg_repo_size_kb: number;
}

export interface GitHubLanguageAnalysis {
  primary: string;
  breakdown: Record<string, number>;
  total_languages: number;
}

export interface GitHubActivity {
  total_commits_estimated: number;
  total_push_events_90d: number;
  total_pr_events_90d: number;
  total_issue_events_90d: number;
  contribution_days_90d: number;
  avg_weekly_events: number;
  event_types: Record<string, number>;
}

export interface GitHubOpenSource {
  external_contributions: number;
  forked_and_contributed: number;
  popular_repos: { name: string; stars: number; forks: number; language: string }[];
}

export interface GitHubIntelligence {
  source: "github_api" | "cached" | "partial" | "fallback";
  data_quality: "verified" | "partial" | "estimated";
  fetched_at: string;
  profile: GitHubProfile;
  repositories: GitHubRepoAnalysis;
  languages: GitHubLanguageAnalysis;
  activity: GitHubActivity;
  open_source: GitHubOpenSource;
}

export interface ProfessionalAnalysis {
  candidate_id: number;
  candidate_name: string;
  github_username: string | null;
  github_intelligence: GitHubIntelligence;
  scores: BehavioralDetails;
  insights: string[];
  resume_intelligence: {
    skills: string[];
    education: Education[];
    certifications: string[];
    total_career_months: number;
  };
  career_trajectory: TrajectoryDetails;
  linkedin_intelligence: {
    url: string | null;
    has_profile: boolean;
    profile_strength: string;
  };
  portfolio_analysis: {
    url: string | null;
    has_portfolio: boolean;
    domain_active: boolean;
  };
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  semantic: 0.5,
  adjacency: 0.5,
  trajectory: 0.5,
  behavioral: 0.5,
  success: 0.5,
  learning: 0.5,
  market: 0.5,
  potential: 0.5,
};

export const WEIGHT_LABELS: Record<keyof RankingWeights, string> = {
  semantic: "Semantic Fit",
  adjacency: "Skill Adjacency",
  trajectory: "Career Velocity",
  behavioral: "GitHub Activity",
  success: "Tenure Stability",
  learning: "Learning Velocity",
  market: "Market Trend",
  potential: "Future Potential",
};

export interface LinkedInIntelligence {
  professional_score: number;
  leadership_score: number;
  industry_authority: number;
  career_progression: number;
  certification_strength: number;
  activity_score: number;
  overall_linkedin_score: number;
  data_quality: "high" | "medium" | "low";
}

export interface BenchmarkData {
  global_percentile: number;
  category_percentiles: Record<string, number>;
  benchmark_match: Record<string, number>;
  top_category: string;
  narrative: string;
}

export interface FactorAuditItem {
  label: string;
  raw_score: number;
  weight: number;
  contribution: number;
  contribution_pct: number;
}

export interface ModifierAuditItem {
  label: string;
  value: number;
  multiplier: number;
  impact_pct: number;
}

export interface RankingAudit {
  ranking_audit: Record<string, FactorAuditItem>;
  group_summaries: Record<string, {
    avg_score: number;
    total_contribution: number;
    factor_count: number;
    contribution_pct: number;
  }>;
  modifier_breakdown: Record<string, ModifierAuditItem>;
  total_raw_score: number;
  total_final_score: number;
  modifier_impact: string;
  modifier_impact_raw: number;
  top_contributing_factors: { name: string; contribution_pct: number }[];
  weakest_factors: { name: string; raw_score: number }[];
}

export interface PipelineEvent {
  stage: string;
  label: string;
  status: "pending" | "processing" | "complete" | "error";
  timestamp: number;
  duration_ms: number;
  details?: Record<string, any>;
  stage_index: number;
  total_stages: number;
}

export interface TalentRediscovery {
  candidate_id: number;
  candidate_name: string;
  email: string;
  skills: string[];
  rediscovery_score: number;
  semantic_similarity: number;
  skill_adjacency: number;
  direct_match_ratio: number;
  reason: string;
  transferable_skills: string[];
  github_username: string | null;
}
