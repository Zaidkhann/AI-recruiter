"use client";

import React, { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="text-sm font-bold text-rose-300">Something went wrong</p>
          <p className="text-xs text-slate-400 max-w-md">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
