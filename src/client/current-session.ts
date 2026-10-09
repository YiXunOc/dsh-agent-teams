import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'

/** Session identity projected by ui-session's main-view binding. */
export interface MainSessionBinding {
  readonly key?: SessionId
}

/** Prefer the current ui-session contract, retaining the legacy list fallback. */
export function currentSessionId(
  binding: MainSessionBinding,
  sessions: SessionListState,
): SessionId | undefined {
  return binding.key ?? ('current' in sessions ? sessions.current as SessionId | undefined : undefined)
}

export type MainSessionSource = ObservableSnapshot<MainSessionBinding>