/** Prefer the current ui-session contract, retaining the legacy list fallback. */
export function currentSessionId(binding, sessions) {
    return binding.key ?? ('current' in sessions ? sessions.current : undefined);
}
