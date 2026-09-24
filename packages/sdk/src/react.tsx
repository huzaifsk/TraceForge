"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

// A bare package import, not "./index": this must resolve to the SAME module instance
// the host app's own `import { init } from "@traceforge/sdk"` uses. A relative import
// gets inlined into this separate bundle, producing a second copy of the client
// singleton — `captureException` would then talk to a copy that `init()` never touched
// (and that the bundler can prove is always inactive, so it dead-code-eliminates the
// call entirely). Keeping this external is what makes the two entries share state.
import { captureException } from "@traceforge/sdk"

export interface TraceForgeErrorBoundaryProps {
  children: ReactNode
  /** A node, or a render function receiving the error and a reset callback. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  /** Called after the error is reported, for host-side handling (e.g. a toast). */
  onError?: (error: Error, componentStack: string) => void
}

interface State {
  error: Error | null
}

/** Catches render errors React's own listeners never see (PRD §8). */
export class TraceForgeErrorBoundary extends Component<TraceForgeErrorBoundaryProps, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, {
      mechanism: "error-boundary",
      componentStack: info.componentStack ?? undefined,
    })
    this.props.onError?.(error, info.componentStack ?? "")
  }

  private reset = (): void => this.setState({ error: null })

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    if (typeof fallback === "function") return fallback(error, this.reset)
    return fallback ?? <p role="alert">Something went wrong.</p>
  }
}
