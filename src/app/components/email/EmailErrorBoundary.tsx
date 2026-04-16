"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class EmailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[EmailClient] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
          <div className="text-2xl">⚠</div>
          <div className="text-center">
            <div className="text-xs font-semibold mb-1" style={{ color: "rgba(255,78,203,0.8)" }}>
              Mail client error
            </div>
            <div className="text-[10px] mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              {this.state.error.message}
            </div>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: "rgba(255,78,203,0.12)",
              border: "1px solid rgba(255,78,203,0.35)",
              color: "#ff4ecb",
            }}
          >
            ↺ Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
