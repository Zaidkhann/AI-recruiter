"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/app/lib/api";
import type { ProfessionalAnalysis } from "@/app/lib/types";

export function useProfessionalAnalysis(candidateId: number | null) {
  return useQuery<ProfessionalAnalysis>({
    queryKey: ["professional-analysis", candidateId],
    queryFn: () =>
      apiFetch<ProfessionalAnalysis>(
        `/api/candidates/${candidateId}/professional-analysis`,
      ),
    enabled: !!candidateId,
    staleTime: 5 * 60_000,
  });
}

export function useGitHubAnalysis(candidateId: number | null) {
  return useQuery({
    queryKey: ["github-analysis", candidateId],
    queryFn: () =>
      apiFetch(`/api/candidates/${candidateId}/github-analysis`),
    enabled: !!candidateId,
    staleTime: 5 * 60_000,
  });
}
