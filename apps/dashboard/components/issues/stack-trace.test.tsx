import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { groupFrames, StackTrace } from "./stack-trace"

const frames = [
  {
    function: "OrdersTable",
    filename: "https://shop.test/app.js",
    line: 124,
    column: 18,
    inApp: true,
  },
  {
    function: "renderWithHooks",
    filename: "https://shop.test/react-dom.js",
    line: 1,
    inApp: false,
  },
  { function: "beginWork", filename: "https://shop.test/react-dom.js", line: 2, inApp: false },
  { function: "Dashboard", filename: "https://shop.test/app.js", line: 42, inApp: true },
]

describe("StackTrace", () => {
  it("collapses consecutive library frames", () => {
    expect(groupFrames(frames).map((g) => g.kind)).toEqual(["app", "library", "app"])
  })

  it("renders in-app frames and expands library frames on demand", async () => {
    render(<StackTrace frames={frames} raw="raw" />)
    expect(screen.getByText("OrdersTable")).toBeInTheDocument()
    expect(screen.getByText("/app.js:124:18")).toBeInTheDocument()
    expect(screen.queryByText("renderWithHooks")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /2 library frames/ }))
    expect(screen.getByText("renderWithHooks")).toBeInTheDocument()
  })

  it("renders hostile input as text, never as HTML", () => {
    const hostile = '<img src=x onerror="alert(1)">'
    const { container } = render(
      <StackTrace frames={[{ function: hostile, filename: "x.js", inApp: true }]} raw={hostile} />
    )
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText(hostile)).toBeInTheDocument()
  })
})
