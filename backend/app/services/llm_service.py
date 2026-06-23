import json
import logging
import time
import re
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Dimension returned by models/gemini-embedding-001
EMBEDDING_DIM = 3072

# Track LLM status
llm_status = {
    "provider": "gemini",
    "status": "connected" if settings.GEMINI_API_KEY else "unavailable"
}


class AIResumeParsingError(RuntimeError):
    """Raised when resume parsing cannot be completed by the AI parser."""

KNOWN_TECH_SKILLS = [
    "Python", "React", "Docker", "Kubernetes", "AWS", "FastAPI", "Rust",
    "Go", "TypeScript", "PostgreSQL", "Redis"
]


def _skill_has_text_evidence(text: str, skill: str) -> bool:
    """Match skill names as terms, not substrings inside unrelated words."""
    if not text or not skill:
        return False

    normalized_skill = skill.strip()
    if not normalized_skill:
        return False

    if normalized_skill.lower() == "go":
        return bool(
            re.search(r"(?<![A-Za-z0-9+#.])Go(?![A-Za-z0-9+#.])", text)
            or re.search(r"(?<![A-Za-z0-9+#.])golang(?![A-Za-z0-9+#.])", text, re.IGNORECASE)
        )

    escaped = re.escape(normalized_skill)
    return bool(re.search(rf"(?<![A-Za-z0-9+#.]){escaped}(?![A-Za-z0-9+#.])", text, re.IGNORECASE))


def _extract_known_skills(text: str, include_leadership: bool = False) -> list[str]:
    skills = KNOWN_TECH_SKILLS + (["Leadership"] if include_leadership else [])
    return [skill for skill in skills if _skill_has_text_evidence(text, skill)]


def _clean_parsed_skills(skills: list, source_text: str) -> list:
    cleaned = []
    seen = set()
    for skill in skills or []:
        if not isinstance(skill, str):
            continue
        normalized = skill.strip()
        if not normalized:
            continue

        canonical = "Go" if normalized.lower() in {"go", "golang"} else normalized
        if canonical.lower() in {"go", "golang"} and not _skill_has_text_evidence(source_text, "Go"):
            continue

        key = canonical.lower()
        if key not in seen:
            cleaned.append(canonical)
            seen.add(key)
    return cleaned

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY is not set. LLM features will be unavailable.")

def execute_with_retry(func, *args, retries=3, initial_delay=1.0, **kwargs):
    """Executes a function with exponential backoff retries for transient errors."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
        
    delay = initial_delay
    last_exception = None
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            logger.warning(f"Gemini API call failed (attempt {attempt + 1}/{retries}): {e}. Retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2.0
    raise last_exception

class LLMService:
    def __init__(self):
        self.embedding_model = "models/gemini-embedding-001"
        self.chat_model = "gemini-3.1-flash-lite"

    def get_embedding(self, text: str) -> list:
        if not settings.GEMINI_API_KEY:
            # Return zero vector in fallback mode so that ranking can fallback gracefully
            return [0.0] * EMBEDDING_DIM

        try:
            def _call():
                try:
                    result = genai.embed_content(
                        model=self.embedding_model,
                        content=text,
                        task_type="retrieval_document"
                    )
                    return result['embedding']
                except Exception as ex:
                    ex_str = str(ex).lower()
                    if "not found" in ex_str or "404" in ex_str or "not supported" in ex_str:
                        alt_model = "models/gemini-embedding-2" if self.embedding_model == "models/gemini-embedding-001" else "models/gemini-embedding-001"
                        logger.warning(f"Embedding model {self.embedding_model} not available: {ex}. Falling back to {alt_model}.")
                        self.embedding_model = alt_model
                        result = genai.embed_content(
                            model=self.embedding_model,
                            content=text,
                            task_type="retrieval_document"
                        )
                        return result['embedding']
                    raise ex
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error calling Gemini Embedding after retries: {e}")
            return [0.0] * EMBEDDING_DIM

    def parse_job_description(self, jd_text: str) -> dict:
        prompt = f"""
        Analyze the following Job Description and extract key structured information.
        Return ONLY a JSON object matching this schema:
        {{
            "title": "Job Title",
            "skills_required": ["Skill1", "Skill2", ...],
            "experience_level": "JUNIOR | MID | SENIOR | STAFF",
            "domains": ["Domain1", "Domain2"],
            "key_requirements": ["Requirement1", "Requirement2", ...],
            "inferred_prerequisites": ["Prereq1", "Prereq2"],
            "required_skills": ["Skill1", "Skill2", ...],
            "preferred_skills": ["PrefSkill1", "PrefSkill2", ...],
            "leadership_requirements": ["Req1", ...],
            "industry_domain": "Domain Name",
            "responsibilities": ["Resp1", ...],
            "hidden_requirements": ["HiddenReq1", ...]
        }}

        Job Description:
        {jd_text}
        """
        
        # Simple heuristic parser if Gemini is offline
        def _fallback():
            found_skills = _extract_known_skills(jd_text, include_leadership=True)
            req_skills = [s for s in found_skills if s.lower() != "leadership"]
            pref_skills = ["Rust", "Go"] if "python" in jd_text.lower() else ["React"]
            has_leadership = "leadership" in jd_text.lower() or "lead" in jd_text.lower() or "staff" in jd_text.lower() or "manager" in jd_text.lower()
            
            fallback_res = {
                "title": "Software Engineer",
                "skills_required": req_skills if req_skills else ["Python"],
                "experience_level": "MID",
                "domains": ["Engineering"],
                "key_requirements": ["Backend or Fullstack experience"],
                "inferred_prerequisites": ["Git"],
                "required_skills": req_skills if req_skills else ["Python"],
                "preferred_skills": pref_skills,
                "leadership_requirements": ["Tech Lead experience", "Mentorship"] if has_leadership else [],
                "industry_domain": "Cloud Software",
                "responsibilities": ["Design APIs", "Implement data persistence", "Optimize queries"],
                "hidden_requirements": ["Product sense", "Strong testing standards"]
            }
            return fallback_res

        if not settings.GEMINI_API_KEY:
            return _fallback()

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error parsing JD via Gemini: {e}")
            return _fallback()

    def suggest_skills(self, title: str, description: str) -> list:
        prompt = f"""
        Given the Job Title: "{title}"
        And the Job Description: "{description}"
        Suggest a list of 5-10 key technical skills/technologies that are highly relevant or required for this position.
        Return ONLY a JSON array of strings, e.g. ["Python", "React", "Docker"].
        """
        def _fallback():
            found_skills = _extract_known_skills(f"{title}\n{description}")
            return found_skills if found_skills else ["Python", "Systems Engineering"]

        if not settings.GEMINI_API_KEY:
            return _fallback()

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            res = execute_with_retry(_call)
            if isinstance(res, list):
                return res
            elif isinstance(res, dict) and "skills" in res:
                return res["skills"]
            return _fallback()
        except Exception as e:
            logger.error(f"Error suggesting skills via Gemini: {e}")
            return _fallback()

    def parse_resume(self, resume_text: str) -> dict:
        if not settings.GEMINI_API_KEY:
            raise AIResumeParsingError("AI resume parser is unavailable because GEMINI_API_KEY is not configured.")

        prompt = f"""
        Analyze the following candidate resume/profile text and extract key structured information.
        Extract skills only when the resume contains explicit evidence for that skill.
        Do not infer skills from substrings inside unrelated words.
        Treat "Go" as the Go programming language only when written as a standalone term "Go" or as "Golang".
        Do not extract "Go" from words or names such as Government, Google, good, goals, or ongoing.
        Return ONLY a JSON object matching this schema:
        {{
            "name": "Candidate Full Name",
            "email": "candidate.email@domain.com",
            "phone": "Candidate Phone Number or null",
            "location": "City, State, Country or null",
            "skills": ["Skill1", "Skill2", ...],
            "career_history": [
                {{
                    "company": "Company Name",
                    "title": "Role Title",
                    "duration_months": 24,
                    "description": "Short description of accomplishments",
                    "seniority": "JUNIOR | MID | SENIOR | LEAD"
                }}
            ],
            "education": [
                {{
                    "school": "University/School Name",
                    "degree": "B.S. | M.S. | PhD | etc. or null",
                    "field_of_study": "Computer Science | etc. or null",
                    "graduation_year": "YYYY or null"
                }}
            ],
            "certifications": ["Cert1", ...],
            "github_username": "username or null",
            "github_url": "https://github.com/username or null",
            "linkedin_url": "https://linkedin.com/in/username or null",
            "portfolio_url": "portfolio link or null",
            "personal_website": "personal website link or null",
            "twitter_x": "twitter handle link or null"
        }}

        Resume Text:
        {resume_text}
        """

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            parsed = execute_with_retry(_call)
            if not isinstance(parsed, dict):
                raise AIResumeParsingError("AI resume parser returned an invalid response.")
            parsed["skills"] = _clean_parsed_skills(parsed.get("skills", []), resume_text)

            # Sanitize certifications
            if isinstance(parsed.get("certifications"), list):
                parsed["certifications"] = [c for c in parsed["certifications"] if c and isinstance(c, str)]
                
            # Sanitize education
            if isinstance(parsed.get("education"), list):
                parsed["education"] = [e for e in parsed["education"] if isinstance(e, dict)]
                for edu in parsed["education"]:
                    if edu.get("degree") is None: edu["degree"] = ""
                    
            # Sanitize career history
            if isinstance(parsed.get("career_history"), list):
                parsed["career_history"] = [j for j in parsed["career_history"] if isinstance(j, dict)]
                for job in parsed["career_history"]:
                    if job.get("title") is None: job["title"] = ""
                    if job.get("seniority") is None: job["seniority"] = "mid"
                    if job.get("description") is None: job["description"] = ""

            return parsed
        except AIResumeParsingError:
            raise
        except Exception as e:
            logger.error(f"Error parsing resume via Gemini: {e}")
            raise AIResumeParsingError("AI resume parser failed to process the resume.") from e

    def _generate_debate_fallback(self, candidate_profile: dict, job_details: dict) -> list:
        """Heuristic fallback for hiring committee debate when Gemini is unavailable."""
        c_skills = candidate_profile.get("skills", [])
        j_skills = job_details.get("skills_required", [])
        c_skills_set = {s.lower() for s in c_skills}
        gaps = [s for s in j_skills if s.lower() not in c_skills_set]
        name = candidate_profile.get("name", "the candidate")
        
        turns = [
            {
                "speaker": "Tech Lead",
                "message": f"I reviewed {name}'s profile. They have solid experience with {', '.join(c_skills[:3]) if c_skills else 'core programming languages'}. However, I am concerned that they lack direct experience with {', '.join(gaps[:2]) if gaps else 'some specialized backend tools required for this role'}.",
                "tone": "skeptical"
            },
            {
                "speaker": "Product Manager",
                "message": f"From a product perspective, their previous roles show they've delivered real business impact. If they have strong fundamentals, they can pick up {gaps[0] if gaps else 'any new technology'} quickly.",
                "tone": "enthusiastic"
            },
            {
                "speaker": "Recruiter",
                "message": f"Their tenure looks stable and their career trajectory shows steady progression. I think we should bring them in for an interview to dig deeper into their system design capabilities.",
                "tone": "analytical"
            },
            {
                "speaker": "Tech Lead",
                "message": f"Fair enough. Let's make sure the interview loops specifically test their understanding of the areas where they have gaps.",
                "tone": "analytical"
            },
            {
                "speaker": "Product Manager",
                "message": "Agreed, let's move them to the next stage.",
                "tone": "enthusiastic"
            }
        ]
        return turns

    def _generate_decision_card_fallback(self, candidate_profile: dict, job_details: dict) -> dict:
        """Heuristic fallback for Decision Intelligence Card when Gemini is unavailable."""
        c_skills = candidate_profile.get("skills", [])
        j_skills = job_details.get("skills_required", [])
        
        c_skills_set = {s.lower() for s in c_skills}
        j_skills_set = {s.lower() for s in j_skills}
        
        # Compute strengths based on matching skills
        matching = [s for s in c_skills if s.lower() in j_skills_set]
        strengths = []
        if matching:
            strengths.append(f"Demonstrated competence in core required skills: {', '.join(matching)}.")
        else:
            strengths.append("Broad general engineering background matching standard profiles.")
            
        # Add strengths based on career history length/experience
        history = candidate_profile.get("career_history", [])
        if history:
            total_months = sum(item.get("duration_months", 12) or 12 for item in history if isinstance(item, dict))
            years = round(total_months / 12, 1)
            strengths.append(f"Possesses {years} years of professional experience across {len(history)} roles.")
        
        # Gaps and Risks
        gaps = [s for s in j_skills if s.lower() not in c_skills_set]
        risks = []
        if gaps:
            risks.append(f"Skill gap detected in required areas: {', '.join(gaps)}.")
        else:
            risks.append("No immediate technical skill gaps identified relative to core requirements.")
            
        # Suggested interview questions based on gaps
        interview_questions = []
        if gaps:
            for gap in gaps[:2]:
                interview_questions.append({
                    "question": f"Can you walk us through a time you had to deliver a feature requiring {gap}, and how you ramped up on it?",
                    "rationale": f"Candidate profile lacks direct experience with {gap}, which is required for this role.",
                    "expected_ideal_answer": f"Should focus on quick learning capability, hands-on tutorials, and successful delivery of {gap} features."
                })
        else:
            interview_questions.append({
                "question": "Can you design a scalable system using Python and your preferred database, explaining how you handle connection pooling?",
                "rationale": "General system design validation for senior backend candidates.",
                "expected_ideal_answer": "Should cover connection limits, read-replicas, indexing strategies, and caching tiers like Redis."
            })
            
        # Executive outreach draft
        name = candidate_profile.get("name", "Candidate")
        job_title = job_details.get("title", "Software Engineer")
        email = f"Subject: Opportunity with our engineering team - {job_title}\n\nHi {name.split()[0] if name else 'Candidate'},\n\nI came across your profile and was really impressed by your background, especially your experience with {', '.join(c_skills[:3]) if c_skills else 'modern technologies'}.\n\nWe are looking for a {job_title} to join our team, and I think your experience would make you a great fit. If you're open to a brief chat, let me know when you'd be free to connect next week.\n\nBest regards,\n[Your Name]"
        
        return {
            "status": "fallback",
            "strengths": strengths,
            "risks_and_gaps": risks,
            "suggested_interview_questions": interview_questions,
            "personalized_outreach_email": email
        }

    def generate_debate(self, candidate_profile: dict, job_details: dict) -> list:
        """Generates Hiring Committee debate. Falls back to heuristic rules if Gemini fails."""
        prompt = f"""
        You are simulating a Hiring Committee debate for a candidate being reviewed for a role.
        The committee consists of:
        1. **Tech Lead (TLA)**: Evaluates hard skills, engineering code quality, and technical scale.
        2. **Product Manager (PMA)**: Evaluates delivery mindset, user impact, and product ownership.
        3. **Recruiter (RAA)**: Evaluates career trajectory, tenure stability, and team composition/fit.

        Input Candidate Profile:
        {json.dumps(candidate_profile, indent=2)}

        Input Job Details:
        {json.dumps(job_details, indent=2)}

        Simulate an interactive dialogue debate (5-6 turns total) where they raise concerns and address them, culminating in a consensus.
        Return ONLY a JSON array of messages matching this schema:
        [
            {{
                "speaker": "Tech Lead | Product Manager | Recruiter",
                "message": "Dialogue content speaking directly...",
                "tone": "skeptical | enthusiastic | analytical"
            }}
        ]
        """
        if not settings.GEMINI_API_KEY:
            return self._generate_debate_fallback(candidate_profile, job_details)

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error generating debate via Gemini: {e}. Falling back to rule-based debate.")
            return self._generate_debate_fallback(candidate_profile, job_details)

    def generate_decision_card(self, candidate_profile: dict, job_details: dict) -> dict:
        """Generates Decision Intelligence Card. Falls back to heuristic rules if Gemini fails."""
        prompt = f"""
        Generate a Decision Intelligence Card for the candidate compared to the job.
        Analyze strengths, risks, custom interview questions, and a highly personalized outreach email.
        Return ONLY a JSON object matching this schema:
        {{
            "strengths": ["Strength 1 with exact evidence from resume", "Strength 2..."],
            "risks_and_gaps": ["Risk 1 based on career/skills", "Risk 2..."],
            "suggested_interview_questions": [
                {{
                    "question": "Question text...",
                    "rationale": "Why this specific question fits their background gaps",
                    "expected_ideal_answer": "What a top performer should focus on in their answer"
                }}
            ],
            "personalized_outreach_email": "Subject: ...\\n\\nHi Candidate..."
        }}

        Candidate Profile:
        {json.dumps(candidate_profile, indent=2)}

        Job Details:
        {json.dumps(job_details, indent=2)}
        """
        if not settings.GEMINI_API_KEY:
            return self._generate_decision_card_fallback(candidate_profile, job_details)

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error generating decision card via Gemini: {e}. Falling back to rule-based card.")
            return self._generate_decision_card_fallback(candidate_profile, job_details)

    def copilot_chat(self, chat_history: list, user_prompt: str, job_title: str) -> dict:
        prompt = f"""
        You are the AI Recruiter Copilot. You assist recruiters in ranking and filtering candidates.
        Your output should address the user's natural language request and output a set of weights (values 0.0 to 1.0) and criteria filters.

        Job Title Context: {job_title}
        User's prompt: "{user_prompt}"

        Previous Chat History:
        {json.dumps(chat_history[-4:], indent=2) if chat_history else "No previous history."}

        You can modify weights for these 8 scoring factors (which default to 0.5):
        - semantic: Match based on resume text embedding
        - adjacency: Match based on related/adjacent skills (systems skills, web skills, etc.)
        - trajectory: Progression velocity / career growth
        - behavioral: GitHub commit volume and active days
        - success: Predicted retention / low hop risk
        - learning: Rate of skill acquisition over time
        - market: Tech trend alignment
        - potential: Predicted future growth / leadership traits

        Return ONLY a JSON object matching this schema:
        {{
            "answer": "Friendly response explaining what parameters you have adjusted or what you recommend...",
            "weight_adjustments": {{
                "semantic": 0.5,
                "adjacency": 0.5,
                "trajectory": 0.5,
                "behavioral": 0.5,
                "success": 0.5,
                "learning": 0.5,
                "market": 0.5,
                "potential": 0.5
            }},
            "benchmark_override": "YC_FOUNDING_ENGINEER | FAANG_STAFF | DEFAULT | null"
        }}
        """
        if not settings.GEMINI_API_KEY:
            return {
                "answer": "The Recruiter Copilot is currently offline because the LLM service is unavailable.",
                "weight_adjustments": {},
                "benchmark_override": None,
                "status": "unavailable",
                "reason": "LLM service unavailable"
            }

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error in Copilot chat via Gemini: {e}")
            return {
                "answer": "The Recruiter Copilot is currently offline because the LLM service is unavailable.",
                "weight_adjustments": {},
                "benchmark_override": None,
                "status": "unavailable",
                "reason": "LLM service unavailable"
            }

    def generate_explanation_card(self, candidate_brief: dict, job_context: dict) -> dict:
        """Generates a detailed explanation card for a candidate's ranking."""
        prompt = f"""You are an expert AI Recruiter generating an evidence-based explanation for a candidate's ranking.
        
Job Context:
{json.dumps(job_context, indent=2)}

Candidate Profile:
{json.dumps(candidate_brief, indent=2)}

Generate a detailed JSON explanation evaluating the candidate against the job context.
CRITICAL: Every strength or risk MUST cite concrete evidence from the profile (e.g. "Led a team of 6 engineers at XYZ" NOT "Strong leadership").
Format your response exactly as the following JSON structure:
{{
  "why_ranked": "A brief explanation of their position",
  "strengths": ["Evidence-based strength 1", "Evidence-based strength 2"],
  "risks": ["Evidence-based risk 1"],
  "missing_skills": {{
      "critical_missing_skills": [],
      "nice_to_have_missing_skills": []
  }},
  "transferable_skills": [],
  "interview_questions": {{
      "technical": [],
      "behavioral": [],
      "role_specific": []
  }},
  "recommended_action": "Strong Hire" | "Interview" | "Consider" | "Reject"
}}
Return ONLY valid JSON.
"""
        if not settings.GEMINI_API_KEY:
            return self._generate_explanation_card_fallback(candidate_brief, job_context)

        try:
            def _call():
                model = genai.GenerativeModel(self.chat_model)
                response = model.generate_content(
                    prompt,
                    generation_config={"response_mime_type": "application/json"}
                )
                return json.loads(response.text.strip())
            return execute_with_retry(_call)
        except Exception as e:
            logger.error(f"Error generating explanation card via Gemini: {e}")
            return self._generate_explanation_card_fallback(candidate_brief, job_context)

    def _generate_explanation_card_fallback(self, candidate_brief: dict, job_context: dict) -> dict:
        c_skills = candidate_brief.get("skills", [])
        job_skills = job_context.get("skills_required", [])
        c_skills_set = {s.lower() for s in c_skills} if c_skills else set()
        j_skills_set = {s.lower() for s in job_skills} if job_skills else set()
        
        missing = list(j_skills_set - c_skills_set)
        critical_missing = missing[:3]
        nice_missing = missing[3:]
        transferable = list(c_skills_set.intersection(j_skills_set))[:5]
        
        strengths = ["Strong core skill overlap"] if len(transferable) > 2 else []
        risks = ["Missing critical job skills"] if len(critical_missing) > 0 else []
        
        action = "Consider"
        final_score = candidate_brief.get("final_score", 0.5)
        if final_score > 0.8:
            action = "Strong Hire"
        elif final_score > 0.6:
            action = "Interview"
        elif final_score < 0.3:
            action = "Reject"

        return {
            "why_ranked": "Based on overall multi-factor matching (Fallback mode).",
            "strengths": strengths,
            "risks": risks,
            "missing_skills": {
                "critical_missing_skills": critical_missing,
                "nice_to_have_missing_skills": nice_missing
            },
            "transferable_skills": transferable,
            "interview_questions": {
                "technical": [f"Can you discuss your experience with {s}?" for s in transferable[:2]],
                "behavioral": ["Can you describe a time you faced a difficult technical challenge?"],
                "role_specific": ["How do you approach learning new skills on the job?"]
            },
            "recommended_action": action
        }

llm_service = LLMService()
