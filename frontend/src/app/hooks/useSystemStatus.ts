"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/app/lib/api";
import type { SystemStatus } from "@/app/lib/types";

export function useSystemStatus() {
  return useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: () => apiFetch<SystemStatus>("/api/system/status"),
    refetchInterval: 10_000,
    retry: 1,
    placeholderData: (prev) => prev,
    // If the backend is unreachable, degrade gracefully
    throwOnError: false,
  });
}
