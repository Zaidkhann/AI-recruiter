import json
import logging
import time
import re
import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Track LLM status
llm_status = {
    "provider": "gemini",
    "status": "connected" if settings.GEMINI_API_KEY else "unavailable"
}

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
        self.chat_model = "gemini-1.5-flash"

    def get_embedding(self, text: str) -> list:
        if not settings.GEMINI_API_KEY:
            # Return zero vector in fallback mode so that ranking can fallback gracefully
            return [0.0] * 768

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
            return [0.0] * 768

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
            skills = ["Python", "React", "Docker", "Kubernetes", "AWS", "FastAPI", "Rust", "Go", "TypeScript", "PostgreSQL", "Redis", "Leadership"]
            found_skills = [s for s in skills if s.lower() in jd_text.lower()]
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

    def parse_resume(self, resume_text: str) -> dict:
        prompt = f"""
        Analyze the following candidate resume/profile text and extract key structured information.
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
        
        # Simple heuristic parser if Gemini is offline
        def _fallback():
            # Extract email
            email = "candidate@example.com"
            email_match = re.search(r'[\w\.-]+@[\w\.-]+', resume_text)
            if email_match:
                email = email_match.group(0)
                name = email.split('@')[0].replace('.', ' ').title()
            else:
                name = "Candidate Name"
                
            # Extract phone
            phone = None
            phone_match = re.search(r'\+?[\d\s-]{10,15}', resume_text)
            if phone_match:
                phone = phone_match.group(0).strip()
                
            # Extract GitHub username
            github_username = None
            github_match = re.search(r'github\.com/([\w-]+)', resume_text, re.IGNORECASE)
            if github_match:
                github_username = github_match.group(1)
            elif "github:" in resume_text.lower():
                gh_match = re.search(r'github:\s*([\w-]+)', resume_text, re.IGNORECASE)
                if gh_match:
                    github_username = gh_match.group(1)
            
            github_url = f"https://github.com/{github_username}" if github_username else None
            
            # Extract LinkedIn
            linkedin_url = None
            li_match = re.search(r'(linkedin\.com/in/[\w-]+)', resume_text, re.IGNORECASE)
            if li_match:
                linkedin_url = "https://" + li_match.group(1)
                
            # Extract Portfolio/Website
            portfolio_url = None
            personal_website = None
            web_matches = re.findall(r'(https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})', resume_text)
            for url in web_matches:
                if "github.com" not in url and "linkedin.com" not in url and "twitter.com" not in url:
                    if not portfolio_url:
                        portfolio_url = url
                        personal_website = url
                    else:
                        personal_website = url
            
            # Extract Twitter/X
            twitter_x = None
            tw_match = re.search(r'(twitter\.com/[\w-]+|x\.com/[\w-]+)', resume_text, re.IGNORECASE)
            if tw_match:
                twitter_x = "https://" + tw_match.group(1)

            skills = ["Python", "React", "Docker", "Kubernetes", "AWS", "FastAPI", "Rust", "Go", "TypeScript", "PostgreSQL", "Redis"]
            found_skills = [s for s in skills if s.lower() in resume_text.lower()]
            
            return {
                "name": name,
                "email": email,
                "phone": phone,
                "location": "San Francisco, CA" if "san francisco" in resume_text.lower() else "Remote",
                "skills": found_skills if found_skills else ["Python"],
                "career_history": [
                    {"company": "Previous Company", "title": "Software Engineer", "duration_months": 12, "description": "Built system features", "seniority": "MID"}
                ],
                "education": [
                    {"school": "State University", "degree": "B.S.", "field_of_study": "Computer Science", "graduation_year": "2020"}
                ],
                "certifications": [],
                "github_username": github_username,
                "github_url": github_url,
                "linkedin_url": linkedin_url,
                "portfolio_url": portfolio_url,
                "personal_website": personal_website,
                "twitter_x": twitter_x
            }

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
            logger.error(f"Error parsing resume via Gemini: {e}")
            return _fallback()

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


