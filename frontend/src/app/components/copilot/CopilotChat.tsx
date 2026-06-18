"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { CopilotMessage, RankingWeights } from "@/app/lib/types";

interface Props {
  history: CopilotMessage[];
  isTyping: boolean;
  onSend: (prompt: string) => void;
}

export const CopilotChat = memo(function CopilotChat({ history, isTyping, onSend }: Props) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-2xl flex flex-col flex-1 shadow-md overflow-hidden min-h-[300px]">
      {/* Header */}
      <div className="bg-[#191928] border-b border-[#242435] px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
          <Sparkles className="h-4 w-4" /> Recruiter AI Copilot
        </span>
        <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
          AGENT ACTIVE
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl p-3 shadow ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-none"
                  : "bg-[#1e1e2d] border border-[#2e2e45] text-slate-200 rounded-bl-none"
              }`}
            >
              {msg.content}
              {msg.role === "assistant" && msg.adjustments && (
                <div className="mt-2 pt-2 border-t border-[#2e2e45] flex flex-wrap gap-1">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                    Scoring weights re-aligned
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#1e1e2d] border border-[#2e2e45] text-slate-400 rounded-xl rounded-bl-none p-3 flex items-center gap-1.5">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce [animation-delay:0.2s]">●</span>
              <span className="animate-bounce [animation-delay:0.4s]">●</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#242435] flex items-center gap-2 bg-[#0d0d16]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot (e.g. 'find candidates who learn fast')..."
          className="flex-1 bg-[#14141d] border border-[#242435] focus:border-indigo-500 focus:outline-none px-3.5 py-2 rounded-xl text-xs text-slate-100"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-xl text-white transition-all active:scale-95 flex items-center justify-center shadow"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
});
