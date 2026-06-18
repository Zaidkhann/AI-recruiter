"use client";

import { useCallback, useRef, useState } from "react";
import { apiPost } from "@/app/lib/api";
import type { CopilotMessage, RankingWeights } from "@/app/lib/types";

const INITIAL_MESSAGE: CopilotMessage = {
  role: "assistant",
  content: "Welcome! I am your AI Recruiter Copilot. Ask me to adjust search weights, compare profiles, or search candidates.",
};

export function useCopilot() {
  const [history, setHistory] = useState<CopilotMessage[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(
    async (
      prompt: string,
      jobId: number,
      onWeightsAdjusted?: (w: Partial<RankingWeights>) => void,
    ) => {
      if (!prompt.trim() || !jobId) return;

      setHistory((prev) => [...prev, { role: "user", content: prompt }]);
      setIsTyping(true);

      try {
        const data = await apiPost<{
          answer: string;
          weight_adjustments?: Partial<RankingWeights>;
        }>("/api/copilot", {
          session_id: "demo-session-id",
          job_id: jobId,
          prompt,
        });

        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, adjustments: data.weight_adjustments },
        ]);

        if (data.weight_adjustments && onWeightsAdjusted) {
          onWeightsAdjusted(data.weight_adjustments);
        }
      } catch {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: "LLM service is currently unavailable. Connection failed." },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [],
  );

  return { history, isTyping, sendMessage };
}
