"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/app/lib/api";
import type { TeamMember } from "@/app/lib/types";
import { useMemo } from "react";

export function useTeam() {
  const query = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch<TeamMember[]>("/api/team"),
    staleTime: 60_000,
  });

  const teamSkills = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<string>();
    query.data.forEach((m) => m.skills?.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [query.data]);

  return { ...query, teamSkills };
}
