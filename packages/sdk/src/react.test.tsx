import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { captureException } from "@traceforge/sdk"

import { TraceForgeErrorBoundary } from "./react"

// react.tsx imports "@traceforge/sdk" (not "./index") so it shares the built package's
// client singleton with the host app — see the comment in react.tsx. Mock that same
// specifier here so the test observes what react.tsx actually calls.
vi.mock("@traceforge/sdk", () => ({ captureException: vi.fn() }))

function Boom(): never {
  throw new Error("kaboom")
}

describe("TraceForgeErrorBoundary", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // React logs caught errors to console.error; expected noise for these tests.
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("renders children when nothing throws", () => {
    render(
      <TraceForgeErrorBoundary>
        <p>all good</p>
      </TraceForgeErrorBoundary>
    )
    expect(screen.getByText("all good")).toBeTruthy()
    expect(captureException).not.toHaveBeenCalled()
  })

  it("captures the error with mechanism error-boundary and a component stack", () => {
    render(
      <TraceForgeErrorBoundary>
        <Boom />
      </TraceForgeErrorBoundary>
    )
    expect(captureException).toHaveBeenCalledTimes(1)
    const [error, context] = vi.mocked(captureException).mock.calls[0]!
    expect((error as Error).message).toBe("kaboom")
    expect(context?.mechanism).toBe("error-boundary")
    expect(context?.componentStack).toEqual(expect.stringContaining("Boom"))
  })

  it("renders the default fallback when no fallback prop is given", () => {
    render(
      <TraceForgeErrorBoundary>
        <Boom />
      </TraceForgeErrorBoundary>
    )
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong.")
  })

  it("renders a plain node fallback", () => {
    render(
      <TraceForgeErrorBoundary fallback={<p>custom fallback</p>}>
        <Boom />
      </TraceForgeErrorBoundary>
    )
    expect(screen.getByText("custom fallback")).toBeTruthy()
  })

  it("renders a function fallback and resets on demand", () => {
    let shouldThrow = true
    function Maybe(): React.ReactNode {
      if (shouldThrow) throw new Error("kaboom")
      return <p>recovered</p>
    }
    const { rerender } = render(
      <TraceForgeErrorBoundary
        fallback={(error, reset) => <button onClick={reset}>{error.message}</button>}
      >
        <Maybe />
      </TraceForgeErrorBoundary>
    )
    const button = screen.getByRole("button", { name: "kaboom" })
    shouldThrow = false
    button.click()
    rerender(
      <TraceForgeErrorBoundary
        fallback={(error, reset) => <button onClick={reset}>{error.message}</button>}
      >
        <Maybe />
      </TraceForgeErrorBoundary>
    )
    expect(screen.getByText("recovered")).toBeTruthy()
  })

  it("calls onError with the error and component stack", () => {
    const onError = vi.fn()
    render(
      <TraceForgeErrorBoundary onError={onError}>
        <Boom />
      </TraceForgeErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    const [error, componentStack] = onError.mock.calls[0]!
    expect((error as Error).message).toBe("kaboom")
    expect(componentStack).toEqual(expect.stringContaining("Boom"))
  })
})
