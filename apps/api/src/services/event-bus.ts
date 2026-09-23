import { EventEmitter } from "node:events"

import type { LiveEvent } from "@traceforge/event-schema"

type Listener = (events: readonly LiveEvent[]) => void

/** Per project, the most recent events kept for reconnecting clients (SSE Last-Event-ID). */
const REPLAY_SIZE = 100

/**
 * In-process pub/sub from ingestion to live subscribers (SSE), keyed by
 * project (ADR 16). Swap for Postgres LISTEN/NOTIFY behind this interface
 * when the API runs as more than one instance.
 */
export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: false })
  private readonly recent = new Map<string, LiveEvent[]>()

  constructor() {
    // Many dashboard tabs may watch one project; leaks are guarded by tests instead.
    this.emitter.setMaxListeners(0)
  }

  publish(projectId: string, events: readonly LiveEvent[]): void {
    if (events.length === 0) return
    const buffer = [...(this.recent.get(projectId) ?? []), ...events].slice(-REPLAY_SIZE)
    this.recent.set(projectId, buffer)
    this.emitter.emit(projectId, events)
  }

  /** Events published after `lastEventId`, if it is still in the replay buffer. */
  replayAfter(projectId: string, lastEventId: string): LiveEvent[] {
    const buffer = this.recent.get(projectId) ?? []
    const index = buffer.findIndex((event) => event.id === lastEventId)
    return index === -1 ? [] : buffer.slice(index + 1)
  }

  /** Returns an unsubscribe function. */
  subscribe(projectId: string, listener: Listener): () => void {
    this.emitter.on(projectId, listener)
    return () => this.emitter.off(projectId, listener)
  }

  listenerCount(projectId: string): number {
    return this.emitter.listenerCount(projectId)
  }
}
