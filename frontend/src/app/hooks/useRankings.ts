"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/app/lib/api";
import type { Candidate, RankingWeights } from "@/app/lib/types";

interface RankPayload {
  job_id: number;
  weights: RankingWeights;
  benchmark_profile: string;
}

/**
 * Rankings hook with debounced mutations.
 * Slider changes are debounced to avoid hammering the API.
 */
export function useRankings() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: RankPayload) =>
      apiPost<Candidate[]>("/api/rank", payload),
    onSuccess: (data) => {
      setCandidates(data);
      setRankingError(null);
    },
    onError: (error: Error) => {
      setRankingError(error.message);
    },
  });

  const calculateRankings = useCallback(
    (jobId: number, weights: RankingWeights, benchmark: string) => {
      setRankingError(null);
      mutation.mutate({ job_id: jobId, weights, benchmark_profile: benchmark });
    },
    [mutation],
  );

  const debouncedCalculateRankings = useCallback(
    (jobId: number, weights: RankingWeights, benchmark: string, delay = 300) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        calculateRankings(jobId, weights, benchmark);
      }, delay);
    },
    [calculateRankings],
  );

  return {
    candidates,
    isRanking: mutation.isPending,
    rankingError,
    calculateRankings,
    debouncedCalculateRankings,
  };
}
