import httpx
import logging
import time
from datetime import datetime, timezone, timedelta
from app.core.config import settings
from app.db.redis_client import redis_manager

logger = logging.getLogger(__name__)

# Cache TTL constants
CACHE_TTL_PRIMARY = 86400       # 24 hours
CACHE_TTL_STALE = 86400 + 43200  # 36 hours total (24h fresh + 12h stale)


class GitHubService:
    def __init__(self):
        self.headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "AI-Recruiter-Candidate-Intelligence"
        }
        if settings.GITHUB_TOKEN:
            self.headers["Authorization"] = f"token {settings.GITHUB_TOKEN}"
            logger.info("GitHub API client initialized with GITHUB_TOKEN.")
        else:
            logger.warning("No GITHUB_TOKEN set. GitHub API calls will be subject to strict rate limits (60/hr).")

        self._rate_limit_remaining = 5000
        self._rate_limit_reset = 0

    # ────────────────────────────────────────────────────
    #  PUBLIC INTERFACE
    # ────────────────────────────────────────────────────

    def fetch_analysis(self, username: str) -> dict:
        """
        Primary method: fetches comprehensive GitHub intelligence for a user.
        Uses 24h cache with stale-while-revalidate.
        Returns rich analysis dict with source/data_quality transparency.
        """
        if not username:
            return self._get_fallback_analysis(username)

        # 1. Check cache
        cache_key = f"github:analysis:{username.lower()}"
        cached = redis_manager.cache_get(cache_key)
        if cached:
            fetched_at = cached.get("fetched_at", "")
            if fetched_at:
                try:
                    fetch_time = datetime.fromisoformat(fetched_at)
                    age_seconds = (datetime.now(timezone.utc) - fetch_time).total_seconds()
                    if age_seconds < CACHE_TTL_PRIMARY:
                        cached["source"] = "cached"
                        logger.info(f"GitHub cache hit for {username} (age: {age_seconds:.0f}s)")
                        return cached
                    elif age_seconds < CACHE_TTL_STALE:
                        # Stale but usable — return stale data, log for future background refresh
                        cached["source"] = "cached"
                        cached["data_quality"] = "partial"
                        logger.info(f"GitHub stale cache hit for {username} (age: {age_seconds:.0f}s)")
                        return cached
                except (ValueError, TypeError):
                    pass

        # 2. Fetch fresh data from GitHub API
        try:
            result = self._fetch_from_github(username)
            # Cache the fresh result
            redis_manager.cache_set(cache_key, result, ttl=CACHE_TTL_STALE)
            return result
        except Exception as e:
            logger.error(f"GitHub API fetch failed for {username}: {e}")
            # If we have any cached data (even stale), use it
            if cached:
                cached["source"] = "cached"
                cached["data_quality"] = "partial"
                return cached
            return self._get_fallback_analysis(username)

    def fetch_stats(self, username: str) -> dict:
        """
        Backward-compatible wrapper. Returns flat stats dict used by
        existing code (candidates.py upload flow, seed data).
        """
        analysis = self.fetch_analysis(username)
        return self._extract_flat_stats(analysis)

    # ────────────────────────────────────────────────────
    #  GITHUB API FETCHING
    # ────────────────────────────────────────────────────

    def _fetch_from_github(self, username: str) -> dict:
        """Orchestrates all GitHub API calls for a user."""
        source = "github_api"
        data_quality = "verified"
        partial_failures = []

        with httpx.Client(headers=self.headers, timeout=15.0) as client:
            # --- Profile ---
            profile = self._fetch_profile(client, username)
            if not profile:
                return self._get_fallback_analysis(username)

            # --- Repositories (paginated, up to 300) ---
            repos = self._fetch_repos(client, username)
            if repos is None:
                partial_failures.append("repos")
                repos = []

            # --- Events (recent 90 days, up to 300 events) ---
            events = self._fetch_events(client, username)
            if events is None:
                partial_failures.append("events")
                events = []

            # --- Contributor stats for top repos (commit counts) ---
            top_repos = sorted(repos, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:5]
            commit_estimate = self._estimate_commits_from_contributors(client, username, top_repos)
            if commit_estimate is None:
                partial_failures.append("contributors")
                commit_estimate = 0

        # --- Process collected data ---
        if partial_failures:
            data_quality = "partial"
            source = "partial"

        repo_analysis = self._analyze_repos(repos)
        language_analysis = self._analyze_languages(repos)
        activity_analysis = self._analyze_events(events, username)
        open_source_analysis = self._analyze_open_source(repos, events, username)

        # Combine commit estimate from contributors API with push events
        total_commits = max(commit_estimate, activity_analysis.get("total_push_events_90d", 0) * 3)

        account_age_days = 0
        created_at = profile.get("created_at", "")
        if created_at:
            try:
                created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                account_age_days = (datetime.now(timezone.utc) - created).days
            except (ValueError, TypeError):
                pass

        result = {
            "source": source,
            "data_quality": data_quality,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "profile": {
                "username": username,
                "name": profile.get("name") or username,
                "bio": profile.get("bio") or "",
                "followers": profile.get("followers", 0),
                "following": profile.get("following", 0),
                "account_age_days": account_age_days,
                "avatar_url": profile.get("avatar_url", ""),
            },
            "repositories": repo_analysis,
            "languages": language_analysis,
            "activity": {
                **activity_analysis,
                "total_commits_estimated": total_commits,
            },
            "open_source": open_source_analysis,
            # Backward-compatible flat fields
            "commits_count": total_commits,
            "pull_requests_count": activity_analysis.get("total_pr_events_90d", 0),
            "issues_count": activity_analysis.get("total_issue_events_90d", 0),
            "stars_count": repo_analysis.get("total_stars", 0),
            "forks_count": repo_analysis.get("total_forks", 0),
            "repos_count": repo_analysis.get("total_count", 0),
        }

        return result

    def _fetch_profile(self, client: httpx.Client, username: str) -> dict | None:
        """GET /users/{username}"""
        try:
            res = client.get(f"https://api.github.com/users/{username}")
            self._update_rate_limits(res)
            if res.status_code == 404:
                logger.warning(f"GitHub user not found: {username}")
                return None
            if res.status_code != 200:
                logger.error(f"GitHub profile fetch failed ({res.status_code}): {res.text[:200]}")
                return None
            return res.json()
        except Exception as e:
            logger.error(f"GitHub profile request error for {username}: {e}")
            return None

    def _fetch_repos(self, client: httpx.Client, username: str) -> list | None:
        """GET /users/{username}/repos — paginated up to 3 pages (300 repos)."""
        all_repos = []
        for page in range(1, 4):
            if not self._check_rate_limit():
                logger.warning("Rate limit low, stopping repo pagination")
                break
            try:
                res = client.get(
                    f"https://api.github.com/users/{username}/repos",
                    params={"per_page": 100, "sort": "pushed", "page": page}
                )
                self._update_rate_limits(res)
                if res.status_code != 200:
                    logger.error(f"GitHub repos fetch failed page {page} ({res.status_code})")
                    break
                page_repos = res.json()
                if not page_repos:
                    break
                all_repos.extend(page_repos)
            except Exception as e:
                logger.error(f"GitHub repos request error page {page}: {e}")
                break
        return all_repos if all_repos else None

    def _fetch_events(self, client: httpx.Client, username: str) -> list | None:
        """GET /users/{username}/events/public — up to 3 pages (300 events, ~90 days)."""
        all_events = []
        for page in range(1, 4):
            if not self._check_rate_limit():
                logger.warning("Rate limit low, stopping events pagination")
                break
            try:
                res = client.get(
                    f"https://api.github.com/users/{username}/events/public",
                    params={"per_page": 100, "page": page}
                )
                self._update_rate_limits(res)
                if res.status_code != 200:
                    break
                page_events = res.json()
                if not page_events:
                    break
                all_events.extend(page_events)
            except Exception as e:
                logger.error(f"GitHub events request error page {page}: {e}")
                break
        return all_events if all_events else None

    def _estimate_commits_from_contributors(self, client: httpx.Client, username: str, top_repos: list) -> int | None:
        """
        GET /repos/{owner}/{repo}/contributors for top repos.
        Extracts the user's total contribution count from each repo.
        """
        total_commits = 0
        for repo in top_repos:
            if not self._check_rate_limit():
                break
            owner = repo.get("owner", {}).get("login", username)
            repo_name = repo.get("name", "")
            if not repo_name:
                continue
            try:
                res = client.get(
                    f"https://api.github.com/repos/{owner}/{repo_name}/contributors",
                    params={"per_page": 30}
                )
                self._update_rate_limits(res)
                if res.status_code != 200:
                    continue
                contributors = res.json()
                if not isinstance(contributors, list):
                    continue
                for contrib in contributors:
                    if contrib.get("login", "").lower() == username.lower():
                        total_commits += contrib.get("contributions", 0)
                        break
            except Exception as e:
                logger.error(f"Contributors request error for {owner}/{repo_name}: {e}")
                continue
        return total_commits

    # ────────────────────────────────────────────────────
    #  DATA ANALYSIS
    # ────────────────────────────────────────────────────

    def _analyze_repos(self, repos: list) -> dict:
        """Analyze repository metrics."""
        if not repos:
            return {
                "total_count": 0, "total_stars": 0, "total_forks": 0,
                "total_watchers": 0, "original_repos": 0, "forked_repos": 0,
                "topics": [], "has_readme_ratio": 0.0, "has_license_ratio": 0.0,
                "avg_repo_size_kb": 0
            }

        total_stars = sum(r.get("stargazers_count", 0) for r in repos)
        total_forks = sum(r.get("forks_count", 0) for r in repos)
        total_watchers = sum(r.get("watchers_count", 0) for r in repos)
        original = [r for r in repos if not r.get("fork", False)]
        forked = [r for r in repos if r.get("fork", False)]

        # Collect topics
        all_topics = set()
        for r in repos:
            for t in r.get("topics", []):
                all_topics.add(t)

        # Documentation signals
        has_description = sum(1 for r in repos if r.get("description"))
        has_license = sum(1 for r in repos if r.get("license"))
        total = len(repos) or 1

        # Repo sizes
        sizes = [r.get("size", 0) for r in repos]
        avg_size = sum(sizes) / len(sizes) if sizes else 0

        return {
            "total_count": len(repos),
            "total_stars": total_stars,
            "total_forks": total_forks,
            "total_watchers": total_watchers,
            "original_repos": len(original),
            "forked_repos": len(forked),
            "topics": sorted(list(all_topics))[:20],
            "has_readme_ratio": round(has_description / total, 2),
            "has_license_ratio": round(has_license / total, 2),
            "avg_repo_size_kb": round(avg_size, 1),
        }

    def _analyze_languages(self, repos: list) -> dict:
        """Analyze language distribution across repos."""
        lang_counts = {}
        for r in repos:
            lang = r.get("language")
            if lang:
                lang_counts[lang] = lang_counts.get(lang, 0) + 1

        if not lang_counts:
            return {"primary": "Unknown", "breakdown": {}, "total_languages": 0}

        sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
        primary = sorted_langs[0][0]

        # Convert to percentage breakdown
        total = sum(v for _, v in sorted_langs)
        breakdown = {}
        for lang, count in sorted_langs[:15]:
            breakdown[lang] = round((count / total) * 100, 1)

        return {
            "primary": primary,
            "breakdown": breakdown,
            "total_languages": len(lang_counts),
        }

    def _analyze_events(self, events: list, username: str) -> dict:
        """Analyze public events for activity signals."""
        if not events:
            return {
                "total_push_events_90d": 0,
                "total_pr_events_90d": 0,
                "total_issue_events_90d": 0,
                "contribution_days_90d": 0,
                "avg_weekly_events": 0.0,
                "event_types": {},
            }

        now = datetime.now(timezone.utc)
        cutoff_90d = now - timedelta(days=90)

        event_type_counts = {}
        contribution_dates = set()
        push_events = 0
        pr_events = 0
        issue_events = 0

        for event in events:
            event_type = event.get("type", "")
            created_str = event.get("created_at", "")

            # Parse event time
            try:
                event_time = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue

            if event_time < cutoff_90d:
                continue

            # Count by type
            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
            contribution_dates.add(event_time.date())

            if event_type == "PushEvent":
                # Count commits within push events
                payload = event.get("payload", {})
                commit_count = len(payload.get("commits", []))
                push_events += max(1, commit_count)
            elif event_type == "PullRequestEvent":
                pr_events += 1
            elif event_type in ("IssuesEvent", "IssueCommentEvent"):
                issue_events += 1

        contribution_days = len(contribution_dates)
        weeks = 13  # ~90 days
        avg_weekly = round(sum(event_type_counts.values()) / weeks, 1)

        return {
            "total_push_events_90d": push_events,
            "total_pr_events_90d": pr_events,
            "total_issue_events_90d": issue_events,
            "contribution_days_90d": contribution_days,
            "avg_weekly_events": avg_weekly,
            "event_types": event_type_counts,
        }

    def _analyze_open_source(self, repos: list, events: list, username: str) -> dict:
        """Analyze open-source contribution signals."""
        # Popular repos (10+ stars)
        popular = []
        for r in repos:
            if r.get("stargazers_count", 0) >= 10 and not r.get("fork", False):
                popular.append({
                    "name": r.get("name", ""),
                    "stars": r.get("stargazers_count", 0),
                    "forks": r.get("forks_count", 0),
                    "language": r.get("language") or "Unknown",
                })
        popular.sort(key=lambda x: x["stars"], reverse=True)

        # External contributions from events (PRs/pushes to repos not owned by user)
        external_repos = set()
        forked_contributed = set()
        for event in (events or []):
            repo_info = event.get("repo", {})
            repo_full = repo_info.get("name", "")
            if "/" in repo_full:
                owner = repo_full.split("/")[0]
                if owner.lower() != username.lower():
                    if event.get("type") in ("PushEvent", "PullRequestEvent", "PullRequestReviewEvent"):
                        external_repos.add(repo_full)

        # Forked repos that received pushes
        forked_repo_names = {r.get("full_name", "").lower() for r in repos if r.get("fork", False)}
        for event in (events or []):
            repo_name = event.get("repo", {}).get("name", "").lower()
            if repo_name in forked_repo_names and event.get("type") == "PushEvent":
                forked_contributed.add(repo_name)

        return {
            "external_contributions": len(external_repos),
            "forked_and_contributed": len(forked_contributed),
            "popular_repos": popular[:10],
        }

    # ────────────────────────────────────────────────────
    #  RATE LIMIT HANDLING
    # ────────────────────────────────────────────────────

    def _update_rate_limits(self, response: httpx.Response):
        """Read rate limit headers from GitHub response."""
        try:
            remaining = response.headers.get("X-RateLimit-Remaining")
            reset_at = response.headers.get("X-RateLimit-Reset")
            if remaining is not None:
                self._rate_limit_remaining = int(remaining)
            if reset_at is not None:
                self._rate_limit_reset = int(reset_at)

            if self._rate_limit_remaining < 50:
                logger.warning(f"GitHub rate limit low: {self._rate_limit_remaining} remaining")
        except (ValueError, TypeError):
            pass

        # Handle 403/429 rate limit responses
        if response.status_code in (403, 429):
            reset_time = self._rate_limit_reset
            wait = max(0, reset_time - int(time.time())) + 1
            logger.warning(f"GitHub rate limited. Reset in {wait}s. Remaining: {self._rate_limit_remaining}")

    def _check_rate_limit(self) -> bool:
        """Returns False if rate limit is too low to make more requests."""
        if self._rate_limit_remaining < 10:
            now = int(time.time())
            if now < self._rate_limit_reset:
                logger.warning(f"Skipping GitHub API call — rate limit exhausted ({self._rate_limit_remaining} remaining)")
                return False
        return True

    # ────────────────────────────────────────────────────
    #  FALLBACK & COMPATIBILITY
    # ────────────────────────────────────────────────────

    def _get_fallback_analysis(self, username: str = "") -> dict:
        """Returns a clearly-labeled fallback/estimated analysis."""
        return {
            "source": "fallback",
            "data_quality": "estimated",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "profile": {
                "username": username or "unknown",
                "name": username or "Unknown",
                "bio": "",
                "followers": 0,
                "following": 0,
                "account_age_days": 0,
                "avatar_url": "",
            },
            "repositories": {
                "total_count": 4, "total_stars": 5, "total_forks": 1,
                "total_watchers": 5, "original_repos": 3, "forked_repos": 1,
                "topics": [], "has_readme_ratio": 0.5, "has_license_ratio": 0.25,
                "avg_repo_size_kb": 500,
            },
            "languages": {
                "primary": "Python",
                "breakdown": {"Python": 60, "JavaScript": 40},
                "total_languages": 2,
            },
            "activity": {
                "total_commits_estimated": 120,
                "total_push_events_90d": 15,
                "total_pr_events_90d": 3,
                "total_issue_events_90d": 1,
                "contribution_days_90d": 10,
                "avg_weekly_events": 1.5,
                "event_types": {},
            },
            "open_source": {
                "external_contributions": 0,
                "forked_and_contributed": 0,
                "popular_repos": [],
            },
            # Backward-compatible flat fields
            "commits_count": 120,
            "pull_requests_count": 8,
            "issues_count": 2,
            "stars_count": 5,
            "forks_count": 1,
            "repos_count": 4,
        }

    def _extract_flat_stats(self, analysis: dict) -> dict:
        """Extract backward-compatible flat stats from rich analysis."""
        langs = analysis.get("languages", {})
        lang_list = list(langs.get("breakdown", {}).keys())[:5] if isinstance(langs, dict) else []

        return {
            "commits_count": analysis.get("commits_count", analysis.get("activity", {}).get("total_commits_estimated", 120)),
            "pull_requests_count": analysis.get("pull_requests_count", analysis.get("activity", {}).get("total_pr_events_90d", 8)),
            "issues_count": analysis.get("issues_count", analysis.get("activity", {}).get("total_issue_events_90d", 2)),
            "stars_count": analysis.get("stars_count", analysis.get("repositories", {}).get("total_stars", 5)),
            "forks_count": analysis.get("forks_count", analysis.get("repositories", {}).get("total_forks", 1)),
            "repos_count": analysis.get("repos_count", analysis.get("repositories", {}).get("total_count", 4)),
            "languages": lang_list or ["Python", "JavaScript"],
            "source": analysis.get("source", "fallback"),
            "data_quality": analysis.get("data_quality", "estimated"),
        }

    def _get_fallback_stats(self) -> dict:
        """Backward-compatible fallback stats for seed data / missing usernames."""
        return {
            "commits_count": 120,
            "pull_requests_count": 8,
            "issues_count": 2,
            "stars_count": 5,
            "forks_count": 1,
            "repos_count": 4,
            "languages": ["Python", "JavaScript"],
            "source": "fallback",
            "data_quality": "estimated",
        }


github_service = GitHubService()
