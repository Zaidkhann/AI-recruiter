"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/app/lib/api";
import type { DecisionData } from "@/app/lib/types";

export function useDecision(jobId: number | null, candidateId: number | null) {
  return useQuery<DecisionData>({
    queryKey: ["decision", jobId, candidateId],
    queryFn: () =>
      apiFetch<DecisionData>(`/api/rank/${jobId}/candidate/${candidateId}/decision`),
    enabled: !!jobId && !!candidateId,
    staleTime: 5 * 60_000, // 5 min — cached on backend too
  });
}
