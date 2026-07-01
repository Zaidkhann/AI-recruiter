import csv
import heapq
import json
import re
import sys
import time
from datetime import datetime

# --- JD Criteria (Senior AI Engineer — Redrob) ---

EMBEDDING_SKILLS = {
    "sentence-transformers", "sentence transformers", "openai embeddings", "embeddings",
    "bge", "e5", "text-embedding",
}
VECTOR_DB_SKILLS = {
    "pinecone", "weaviate", "qdrant", "milvus", "opensearch", "elasticsearch",
    "faiss", "pgvector", "chroma", "vectordb", "vector database",
}
EVAL_SKILLS = {"ndcg", "mrr", "map", "a/b test", "ab test", "offline-to-online", "learning-to-rank", "learning to rank"}
PYTHON_MARKERS = {"python"}
NICE_SKILLS = {"lora", "qlora", "peft", "xgboost", "lightgbm", "distributed systems", "large-scale inference", "rag", "semantic search", "information retrieval"}

CONSULTING_FIRMS = {
    "tcs", "infosys", "wipro", "accenture", "cognizant", "capgemini", "mindtree",
    "tata consultancy", "ibm consulting", "deloitte", "pwc", "ey", "kpmg", "hcl",
}

PREFERRED_CITIES = ("pune", "noida")
TIER1_CITIES = ("hyderabad", "mumbai", "delhi", "ncr", "bangalore", "bengaluru", "chennai", "gurgaon", "gurugram")

NON_ML_ROLE_RE = re.compile(
    r"\b(marketing manager|marketing|graphic designer|content writer|accountant|"
    r"sales|business analyst|project manager|hr manager|recruiter|finance manager|"
    r"legal counsel|operations manager|customer success|account manager)\b",
    re.IGNORECASE,
)
ML_ROLE_RE = re.compile(
    r"\b(ml engineer|machine learning engineer|ai engineer|nlp engineer|search engineer|"
    r"retrieval|ranking|recommendation|applied ml|applied scientist|research engineer|"
    r"deep learning engineer|data scientist)\b",
    re.IGNORECASE,
)
RESEARCH_ONLY_RE = re.compile(
    r"\b(research scientist|phd candidate|postdoc|graduate researcher|research fellow)\b",
    re.IGNORECASE,
)
ARCHITECT_ONLY_RE = re.compile(
    r"\b(solution architect|enterprise architect|chief architect|architecture lead)\b",
    re.IGNORECASE,
)

RETRIEVAL_CAREER_RE = re.compile(
    r"\b(retrieval|ranking|search|recommendation|recsys|vector|embedding|hybrid search|"
    r"semantic search|learning-to-rank|learning to rank|rerank|re-rank)\b",
    re.IGNORECASE,
)
EVAL_CAREER_RE = re.compile(
    r"\b(ndcg|mrr|map@|recall@|a/b test|ab test|offline.online|offline-to-online|"
    r"evaluation framework|eval harness|relevance label)\b",
    re.IGNORECASE,
)
PRODUCTION_RE = re.compile(
    r"\b(production|shipped|deployed|real users|at scale|serving \d|queries per month|qps)\b",
    re.IGNORECASE,
)
LANGCHAIN_ONLY_RE = re.compile(r"\b(langchain|llamaindex|haystack)\b", re.IGNORECASE)
CV_ONLY_RE = re.compile(r"\b(computer vision|speech recognition|robotics|image classification)\b", re.IGNORECASE)
NLP_IR_RE = re.compile(r"\b(nlp|natural language|information retrieval|text processing|ir\b)\b", re.IGNORECASE)
HR_TECH_RE = re.compile(
    r"\b(recruiter|talent intelligence|candidate.?jd|hr.?tech|hiring workflow|"
    r"applicant tracking|ats\b|talent matching|job matching)\b",
    re.IGNORECASE,
)

SENIORITY_RE = re.compile(r"\b(intern|junior|mid|senior|staff|principal|lead|director)\b", re.IGNORECASE)

REFERENCE_DATE = datetime(2026, 6, 29)


def _candidate_id_num(candidate_id):
    match = re.search(r"(\d+)$", candidate_id or "")
    return int(match.group(1)) if match else 0


def _heap_key(raw_score, candidate_id):
    """Min-heap key: evict lowest score; on ties evict highest candidate_id."""
    return (raw_score, -_candidate_id_num(candidate_id))


def detect_honeypot(candidate):
    """Profiles with impossible timelines are synthetic noise."""
    profile = candidate.get("profile", {})
    skills = candidate.get("skills", [])
    career = candidate.get("career_history", [])

    yoe = profile.get("years_of_experience", 0) or 0

    for skill in skills:
        prof = (skill.get("proficiency") or "").lower()
        duration = skill.get("duration_months") or 0
        if prof in ("expert", "advanced") and duration == 0:
            return True
        if duration > (yoe * 12 + 60):
            return True

    total_career_months = sum(
        job.get("duration_months") or 0 for job in career if job.get("duration_months")
    )
    if total_career_months > (yoe * 12 + 60) and total_career_months > 120:
        return True

    return False


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None


def _norm_skill(name):
    return (name or "").strip().lower()


def _skill_matches(name, keywords):
    n = _norm_skill(name)
    return any(kw in n for kw in keywords)


def _current_job(career):
    for job in career:
        if job.get("is_current"):
            return job
    return career[0] if career else {}


def _is_consulting_company(company):
    c = (company or "").lower()
    return any(firm in c for firm in CONSULTING_FIRMS)


def _collect_text(candidate):
    profile = candidate.get("profile", {})
    parts = [
        profile.get("headline") or "",
        profile.get("summary") or "",
        profile.get("current_title") or "",
    ]
    for job in candidate.get("career_history") or []:
        parts.append(job.get("title") or "")
        parts.append(job.get("description") or "")
        parts.append(job.get("company") or "")
    return " ".join(parts).lower()


def _extract_skill_names(skills):
    return [_norm_skill(s.get("name")) for s in skills if s.get("name")]


def _title_chaser_score(career):
    """Rapid seniority jumps with short tenures."""
    if len(career) < 3:
        return 0.0

    levels = []
    tenures = []
    for job in career:
        title = job.get("title") or ""
        match = SENIORITY_RE.search(title.lower())
        if match:
            levels.append(match.group(1))
        months = job.get("duration_months") or 0
        if months:
            tenures.append(months)

    if len(levels) < 2 or not tenures:
        return 0.0

    seniority_order = {
        "intern": 0, "junior": 1, "mid": 2, "senior": 3,
        "lead": 4, "staff": 5, "principal": 6, "director": 7,
    }
    numeric = [seniority_order.get(l, 2) for l in levels]
    avg_tenure = sum(tenures) / len(tenures)
    jumps = sum(1 for i in range(1, len(numeric)) if numeric[i] > numeric[i - 1])

    if jumps >= 2 and avg_tenure < 20:
        return 1.0
    if jumps >= 1 and avg_tenure < 15:
        return 0.6
    return 0.0


def score_candidate(candidate):
    """
    Score a candidate for the Redrob Senior AI Engineer JD.
    Career evidence and role fit dominate; raw skill keywords are secondary.
    Returns (score, metadata dict for reasoning generation).
    """
    profile = candidate.get("profile", {})
    skills = candidate.get("skills") or []
    career = candidate.get("career_history") or []
    redrob = candidate.get("redrob_signals") or {}

    score = 0.0
    concerns = []
    strengths = []

    current_title = profile.get("current_title") or _current_job(career).get("title") or ""
    current_company = profile.get("current_company") or _current_job(career).get("company") or ""
    yoe = float(profile.get("years_of_experience") or 0)
    location = (profile.get("location") or "").lower()
    country = (profile.get("country") or "").lower()
    summary = (profile.get("summary") or "").lower()
    headline = (profile.get("headline") or "").lower()
    full_text = _collect_text(candidate)

    # --- Role fit (critical — keyword trap defense) ---
    role_fit = 0.0
    if NON_ML_ROLE_RE.search(f"{headline} {summary} {current_title}"):
        role_fit -= 35.0
        concerns.append(f"current role ({current_title}) is not an applied ML/AI engineering track")
    elif ML_ROLE_RE.search(f"{headline} {summary} {current_title}"):
        role_fit += 18.0
        strengths.append(f"title aligns with applied ML ({current_title})")
    else:
        role_fit += 4.0

    ml_job_count = 0
    for job in career:
        jt = f"{job.get('title', '')} {job.get('description', '')}".lower()
        if ML_ROLE_RE.search(jt) or RETRIEVAL_CAREER_RE.search(jt):
            ml_job_count += 1
    role_fit += min(12.0, ml_job_count * 4.0)
    score += role_fit

    # --- Career evidence: retrieval / ranking / search in production ---
    retrieval_jobs = 0
    eval_jobs = 0
    production_jobs = 0
    product_jobs = 0
    consulting_jobs = 0
    applied_ml_months = 0
    cv_only_jobs = 0
    nlp_ir_jobs = 0

    for job in career:
        desc = job.get("description") or ""
        title = job.get("title") or ""
        company = job.get("company") or ""
        blob = f"{title} {desc}".lower()

        if _is_consulting_company(company):
            consulting_jobs += 1
        elif company:
            product_jobs += 1

        if RETRIEVAL_CAREER_RE.search(blob):
            retrieval_jobs += 1
        if EVAL_CAREER_RE.search(blob):
            eval_jobs += 1
        if PRODUCTION_RE.search(blob):
            production_jobs += 1
        if CV_ONLY_RE.search(blob) and not NLP_IR_RE.search(blob):
            cv_only_jobs += 1
        if NLP_IR_RE.search(blob):
            nlp_ir_jobs += 1

        if ML_ROLE_RE.search(blob) or RETRIEVAL_CAREER_RE.search(blob):
            if not _is_consulting_company(company):
                applied_ml_months += job.get("duration_months") or 0

    career_score = 0.0
    if retrieval_jobs >= 2:
        career_score += 28.0
        strengths.append("multiple roles shipping retrieval/ranking/search systems")
    elif retrieval_jobs == 1:
        career_score += 18.0
        strengths.append("production retrieval/ranking experience in career history")
    elif RETRIEVAL_CAREER_RE.search(summary):
        career_score += 12.0
        strengths.append("summary describes embedding/retrieval work")

    if eval_jobs >= 1 or EVAL_CAREER_RE.search(summary):
        career_score += 12.0
        strengths.append("hands-on ranking evaluation (NDCG/MRR/A-B) in career narrative")

    if HR_TECH_RE.search(full_text):
        career_score += 8.0
        strengths.append("prior work on recruiter/talent matching or HR-tech systems")

    if production_jobs >= 1:
        career_score += 8.0

    applied_ml_years = applied_ml_months / 12.0
    if applied_ml_years >= 4:
        career_score += 10.0
        strengths.append(f"{applied_ml_years:.1f} years applied ML at product companies")
    elif applied_ml_years >= 2:
        career_score += 5.0

    if product_jobs == 0 and consulting_jobs > 0:
        career_score -= 22.0
        concerns.append("consulting-only background")
    elif product_jobs >= 2:
        career_score += 6.0

    if cv_only_jobs > 0 and nlp_ir_jobs == 0 and retrieval_jobs == 0:
        career_score -= 18.0
        concerns.append("CV/speech/robotics focus without NLP/IR or retrieval exposure")

    score += career_score

    # --- JD disqualifier patterns ---
    if RESEARCH_ONLY_RE.search(full_text) and production_jobs == 0:
        score -= 25.0
        concerns.append("research-heavy profile without clear production deployment")

    if ARCHITECT_ONLY_RE.search(current_title) and not ML_ROLE_RE.search(full_text):
        score -= 15.0
        concerns.append("architecture-focused role with limited hands-on ML coding signal")

    chaser = _title_chaser_score(career)
    if chaser >= 0.6:
        score -= 12.0 * chaser
        concerns.append("title progression suggests frequent short-tenure seniority jumps")

    langchain_hits = len(LANGCHAIN_ONLY_RE.findall(full_text))
    pre_llm_signal = retrieval_jobs + eval_jobs + (
        1 if any(_skill_matches(s.get("name"), EMBEDDING_SKILLS | VECTOR_DB_SKILLS) for s in skills) else 0
    )
    if langchain_hits >= 2 and pre_llm_signal == 0:
        score -= 12.0
        concerns.append("AI experience appears framework/tutorial-heavy without pre-LLM retrieval depth")

    # --- Skills (secondary, duration-aware) ---
    skill_names = _extract_skill_names(skills)
    verified_core = []
    keyword_only = 0

    for skill in skills:
        name = skill.get("name") or ""
        n = _norm_skill(name)
        prof = (skill.get("proficiency") or "").lower()
        duration = skill.get("duration_months") or 0
        prof_mult = {"expert": 1.3, "advanced": 1.1, "intermediate": 0.9, "beginner": 0.5}.get(prof, 0.8)
        dur_mult = 1.0 if duration >= 12 else (0.6 if duration >= 6 else 0.3)

        matched = False
        if _skill_matches(name, EMBEDDING_SKILLS):
            score += 4.0 * prof_mult * dur_mult
            verified_core.append(name)
            matched = True
        elif _skill_matches(name, VECTOR_DB_SKILLS):
            score += 3.5 * prof_mult * dur_mult
            verified_core.append(name)
            matched = True
        elif _skill_matches(name, EVAL_SKILLS):
            score += 3.0 * prof_mult * dur_mult
            verified_core.append(name)
            matched = True
        elif _skill_matches(name, PYTHON_MARKERS):
            score += 2.0 * prof_mult * dur_mult
            matched = True
        elif _skill_matches(name, NICE_SKILLS):
            score += 1.5 * prof_mult * dur_mult
            matched = True

        if matched and duration == 0 and prof in ("expert", "advanced"):
            keyword_only += 1

    ai_skill_count = sum(
        1 for n in skill_names
        if _skill_matches(n, EMBEDDING_SKILLS | VECTOR_DB_SKILLS | EVAL_SKILLS | NICE_SKILLS | {"nlp", "rag"})
    )
    if ai_skill_count >= 6 and retrieval_jobs == 0 and not RETRIEVAL_CAREER_RE.search(summary):
        score -= 10.0
        concerns.append("many AI keywords in skills but no retrieval/ranking evidence in career")

    if keyword_only >= 2:
        score -= 8.0
        concerns.append("expert-level skills listed without duration backing")

    if verified_core:
        strengths.append("core stack: " + ", ".join(sorted(set(verified_core))[:4]))

    # --- Experience band ---
    if 5.0 <= yoe <= 9.0:
        score += 12.0
    elif 4.0 <= yoe <= 12.0:
        score += 7.0
    elif yoe < 4.0:
        score -= 8.0
        concerns.append(f"only {yoe:.1f} years experience (JD targets 5-9)")
    else:
        score += 3.0
        if yoe > 12:
            concerns.append(f"{yoe:.1f} years experience above typical 5-9 band")

    # --- Location ---
    loc_bonus = False
    if "india" in country:
        if any(c in location for c in PREFERRED_CITIES):
            score += 8.0
            loc_bonus = True
            strengths.append("based in Pune/Noida (preferred)")
        elif any(c in location for c in TIER1_CITIES):
            score += 4.0
        if redrob.get("willing_to_relocate"):
            score += 3.0
            strengths.append("willing to relocate to Pune/Noida")
    else:
        score -= 8.0
        concerns.append(f"based outside India ({profile.get('location', 'unknown')})")

    # --- Redrob behavioral signals ---
    np_days = redrob.get("notice_period_days", 90)
    rr = redrob.get("recruiter_response_rate")
    last_active = parse_date(redrob.get("last_active_date"))

    if last_active:
        days_inactive = (REFERENCE_DATE - last_active).days
        if days_inactive <= 30:
            score += 4.0
            strengths.append(f"active on Redrob ({days_inactive}d ago)")
        elif days_inactive > 180:
            score -= 10.0
            concerns.append(f"inactive on platform for {days_inactive} days")
        elif days_inactive > 90:
            score -= 4.0
            concerns.append(f"last active {days_inactive} days ago")

    if rr is not None:
        if rr >= 0.5:
            score += 5.0
            strengths.append(f"recruiter response rate {rr:.0%}")
        elif rr < 0.15:
            score -= 8.0
            concerns.append(f"low recruiter response rate ({rr:.0%})")

    if np_days is not None:
        if np_days <= 30:
            score += 4.0
            strengths.append(f"{np_days}-day notice period")
        elif np_days > 60:
            score -= 3.0
            concerns.append(f"{np_days}-day notice period raises hiring bar")

    if redrob.get("open_to_work_flag") is False and (last_active and (REFERENCE_DATE - last_active).days > 60):
        score -= 5.0
        concerns.append("not flagged open-to-work and low recent activity")

    meta = {
        "current_title": current_title,
        "current_company": current_company,
        "yoe": yoe,
        "location": profile.get("location") or "",
        "country": profile.get("country") or "",
        "strengths": strengths,
        "concerns": concerns,
        "retrieval_jobs": retrieval_jobs,
        "eval_jobs": eval_jobs,
        "verified_core": verified_core,
        "np_days": np_days,
        "recruiter_response_rate": rr,
        "loc_bonus": loc_bonus,
    }

    return max(0.0, score), meta


def generate_reasoning(candidate_id, rank, score, meta):
    """
    Fact-grounded, JD-connected reasoning with tone aligned to rank.
    """
    title = meta["current_title"]
    company = meta["current_company"]
    yoe = meta["yoe"]
    parts = []
    concerns = meta["concerns"]
    strengths = meta["strengths"]

    profile_line = f"{title} at {company} with {yoe:.1f} years of experience."

    if rank <= 10:
        parts.append(
            f"Top-tier match for Redrob's Senior AI Engineer JD (embeddings retrieval, vector search, ranking eval). "
            f"{profile_line}"
        )
        if meta["retrieval_jobs"]:
            parts.append(
                f"Shipped retrieval/ranking in {meta['retrieval_jobs']} production role(s) — "
                "directly maps to owning Redrob's hybrid search and re-ranking layer."
            )
        if meta["eval_jobs"]:
            parts.append(
                "Built ranking evaluation (NDCG/MRR/offline-online calibration) — required for the JD's A/B eval mandate."
            )
        if meta["verified_core"]:
            parts.append("Verified stack: " + ", ".join(sorted(set(meta["verified_core"]))[:5]) + ".")
        for s in strengths[:2]:
            if "prior work" in s or "product companies" in s:
                parts.append(s.capitalize() + ".")
        if meta.get("recruiter_response_rate") is not None and meta["recruiter_response_rate"] >= 0.5:
            parts.append(
                f"Redrob recruiter response rate {meta['recruiter_response_rate']:.0%} — likely reachable."
            )
        if meta.get("np_days") is not None and meta["np_days"] <= 30:
            parts.append(f"{meta['np_days']}-day notice fits the JD's immediate-start preference.")
        if concerns:
            parts.append("Minor flags: " + "; ".join(concerns[:2]) + ".")

    elif rank <= 35:
        parts.append(
            f"Strong profile for the founding AI team. {profile_line} "
            "Career evidence outweighs keyword-only AI skills for this JD."
        )
        if meta["retrieval_jobs"]:
            parts.append(
                f"{meta['retrieval_jobs']} role(s) with retrieval/ranking/search delivery; "
                "aligns with shipping Redrob's v2 ranker."
            )
        elif meta["eval_jobs"]:
            parts.append("Ranking eval experience present; retrieval depth is thinner than top candidates.")
        if meta["verified_core"]:
            parts.append("Skills backed by tenure: " + ", ".join(sorted(set(meta["verified_core"]))[:4]) + ".")
        if concerns:
            parts.append("Gaps: " + "; ".join(concerns[:3]) + ".")
        elif meta.get("np_days") is not None and meta["np_days"] > 60:
            parts.append(f"{meta['np_days']}-day notice raises the bar per JD guidance.")

    elif rank <= 70:
        parts.append(
            f"Moderate fit — meets parts of the JD but not the full retrieval-plus-eval bar. {profile_line}"
        )
        if meta["retrieval_jobs"]:
            parts.append(
                f"Some production retrieval signal ({meta['retrieval_jobs']} role(s)), "
                "but weaker than leaders on hybrid search ownership or behavioral availability."
            )
        else:
            parts.append(
                "No clear end-to-end ranking/search shipment in career history — "
                "core JD requirement for this founding role."
            )
        if meta["verified_core"]:
            parts.append("Partial stack overlap: " + ", ".join(sorted(set(meta["verified_core"]))[:3]) + ".")
        parts.append("Primary concerns: " + ("; ".join(concerns[:3]) if concerns else "limited ranking production depth") + ".")

    else:
        parts.append(
            f"Ranked #{rank} — below the hire bar for this JD despite surface-level ML keywords. {profile_line}"
        )
        lead_concern = concerns[0] if concerns else "insufficient retrieval/ranking production ownership"
        parts.append(f"Main issue: {lead_concern}.")
        if meta["retrieval_jobs"]:
            parts.append(
                f"Has {meta['retrieval_jobs']} retrieval-adjacent role(s), but outweighed by "
                + ("; ".join(concerns[1:3]) if len(concerns) > 1 else "experience/availability gaps")
                + "."
            )
        else:
            parts.append(
                "JD explicitly needs someone who has owned embeddings retrieval and ranking eval at product scale — not demonstrated here."
            )
        if meta.get("recruiter_response_rate") is not None and meta["recruiter_response_rate"] < 0.2:
            parts.append(
                f"Redrob response rate {meta['recruiter_response_rate']:.0%} further lowers practical hire priority."
            )

    reasoning = " ".join(parts)
    if not title or not company:
        reasoning = f"Candidate {candidate_id} (score {score:.4f}). " + reasoning
    return reasoning


def validate_output(rows, valid_ids):
    """Sanity-check submission format constraints."""
    if len(rows) != 100:
        raise ValueError(f"Expected 100 rows, got {len(rows)}")

    ranks = [r["rank"] for r in rows]
    if sorted(ranks) != list(range(1, 101)):
        raise ValueError("Ranks must be exactly 1..100 each once")

    ids = [r["id"] for r in rows]
    if len(set(ids)) != 100:
        raise ValueError("Duplicate candidate_id in output")

    for cid in ids:
        if cid not in valid_ids:
            raise ValueError(f"candidate_id {cid} not in candidates.jsonl")

    scores = [r["score"] for r in rows]
    for i in range(1, len(scores)):
        if scores[i] > scores[i - 1] + 1e-9:
            raise ValueError(f"Scores not non-increasing at rank {i + 1}")


def main():
    start_time = time.time()
    input_file = "candidates.jsonl"
    output_file = "ai_freaks.csv"

    print(f"Starting candidate ranking at {datetime.now().strftime('%H:%M:%S')}")

    heap = []
    total_processed = 0
    honeypot_count = 0
    valid_ids = set()

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            for line in f:
                total_processed += 1
                if total_processed % 10000 == 0:
                    print(f"Processed {total_processed} candidates...")

                try:
                    candidate = json.loads(line)
                except json.JSONDecodeError:
                    continue

                cand_id = candidate.get("candidate_id")
                if not cand_id:
                    continue

                valid_ids.add(cand_id)

                if detect_honeypot(candidate):
                    honeypot_count += 1
                    continue

                raw_score, meta = score_candidate(candidate)

                entry = {
                    "id": cand_id,
                    "raw_score": raw_score,
                    "meta": meta,
                }

                key = _heap_key(raw_score, cand_id)
                if len(heap) < 100:
                    heapq.heappush(heap, (key, cand_id, entry))
                elif key > heap[0][0]:
                    heapq.heapreplace(heap, (key, cand_id, entry))
    except FileNotFoundError:
        print(f"Error: {input_file} not found. Please ensure it's in the current directory.")
        sys.exit(1)

    print(f"Finished processing. Total: {total_processed}, Honeypots: {honeypot_count}")

    top_100 = sorted(heap, key=lambda x: (-x[0][0], _candidate_id_num(x[1])))
    max_score = top_100[0][0][0] if top_100 else 1.0
    if max_score <= 0:
        max_score = 1.0

    output_rows = []
    for rank, (key, cand_id, entry) in enumerate(top_100, start=1):
        raw_score = key[0]
        normalized = min(1.0, max(0.0, raw_score / max_score))
        normalized = round(normalized, 4)
        reasoning = generate_reasoning(cand_id, rank, normalized, entry["meta"])
        output_rows.append({
            "id": cand_id,
            "rank": rank,
            "score": normalized,
            "reasoning": reasoning,
        })

    validate_output(output_rows, valid_ids)

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["candidate_id", "rank", "score", "reasoning"])
        for row in output_rows:
            writer.writerow([row["id"], row["rank"], row["score"], row["reasoning"]])

    elapsed = time.time() - start_time
    print(f"Ranking complete! Output saved to {output_file}. Time taken: {elapsed:.2f} seconds.")
    print(f"Top candidate: {output_rows[0]['id']} (score={output_rows[0]['score']})")
    print(f"Rank 100: {output_rows[-1]['id']} (score={output_rows[-1]['score']})")


if __name__ == "__main__":
    main()
