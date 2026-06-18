"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/app/lib/api";
import type { Job } from "@/app/lib/types";

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: () => apiFetch<Job[]>("/api/jobs"),
    staleTime: 60_000,
  });
}
