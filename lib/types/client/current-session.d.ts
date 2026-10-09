import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
/** Session identity projected by ui-session's main-view binding. */
export interface MainSessionBinding {
    readonly key?: SessionId;
}
/** Prefer the current ui-session contract, retaining the legacy list fallback. */
export declare function currentSessionId(binding: MainSessionBinding, sessions: SessionListState): SessionId | undefined;
export type MainSessionSource = ObservableSnapshot<MainSessionBinding>;
