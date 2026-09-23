/**
 * Compile-time guard: every Zod schema must infer exactly the hand-written
 * type in ./types. If this file fails to typecheck, the two have drifted.
 * It emits no runtime code.
 */
import type { z } from "zod"

import type * as S from "./schema"
import type * as T from "./types"

type Equals<A, B> =
  (<V>() => V extends A ? 1 : 2) extends <V>() => V extends B ? 1 : 2 ? true : false

type Assert<_ extends true> = never

export type SchemaTypeAssertions = [
  Assert<Equals<z.infer<typeof S.pageContextSchema>, T.PageContext>>,
  Assert<Equals<z.infer<typeof S.deviceContextSchema>, T.DeviceContext>>,
  Assert<Equals<z.infer<typeof S.stackFrameSchema>, T.StackFrame>>,
  Assert<Equals<z.infer<typeof S.errorPayloadSchema>, T.ErrorPayload>>,
  Assert<Equals<z.infer<typeof S.apiRequestPayloadSchema>, T.ApiRequestPayload>>,
  Assert<Equals<z.infer<typeof S.apiErrorPayloadSchema>, T.ApiErrorPayload>>,
  Assert<Equals<z.infer<typeof S.webVitalPayloadSchema>, T.WebVitalPayload>>,
  Assert<Equals<z.infer<typeof S.navigationPayloadSchema>, T.NavigationPayload>>,
  Assert<Equals<z.infer<typeof S.performancePayloadSchema>, T.PerformancePayload>>,
  Assert<Equals<z.infer<typeof S.monitoringEventSchema>, T.MonitoringEvent>>,
  Assert<Equals<z.infer<typeof S.sdkInfoSchema>, T.SdkInfo>>,
  Assert<Equals<z.infer<typeof S.ingestResponseSchema>, T.IngestResponse>>,
]
