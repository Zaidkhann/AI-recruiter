"use client";

import React, { memo, useCallback } from "react";
import { Sliders } from "lucide-react";
import type { RankingWeights } from "@/app/lib/types";
import { WEIGHT_LABELS } from "@/app/lib/types";

interface Props {
  weights: RankingWeights;
  selectedBenchmark: string;
  onWeightChange: (key: keyof RankingWeights, value: number) => void;
  onBenchmarkChange: (benchmark: string) => void;
}

export const WeightSliders = memo(function WeightSliders({
  weights,
  selectedBenchmark,
  onWeightChange,
  onBenchmarkChange,
}: Props) {
  return (
    <div className="bg-[#14141d] border border-[#242435] rounded-2xl p-5 flex flex-col shadow-md">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 text-slate-200">
        <Sliders className="h-4 w-4 text-indigo-400" /> Multi-Factor Rank Tuning
      </h3>

      {/* Benchmark Dropdown */}
      <div className="mb-4 flex items-center justify-between bg-[#191928] border border-[#242435] rounded-xl px-3.5 py-2">
        <span className="text-xs text-slate-400 font-semibold">Benchmark Overlay:</span>
        <select
          className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer border-none"
          value={selectedBenchmark}
          onChange={(e) => onBenchmarkChange(e.target.value)}
        >
          <option value="DEFAULT" className="bg-[#14141d] text-slate-300">
            Default Balanced Profile
          </option>
          <option value="YC_FOUNDING_ENGINEER" className="bg-[#14141d] text-slate-300">
            YC Founding Engineer Bar
          </option>
          <option value="FAANG_STAFF" className="bg-[#14141d] text-slate-300">
            FAANG Staff Engineer Bar
          </option>
        </select>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {(Object.keys(weights) as (keyof RankingWeights)[]).map((key) => (
          <SliderRow
            key={key}
            label={WEIGHT_LABELS[key]}
            value={weights[key]}
            onChange={(v) => onWeightChange(key, v)}
          />
        ))}
      </div>
    </div>
  );
});

const SliderRow = memo(function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-indigo-400 font-bold">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#242435] rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
});
