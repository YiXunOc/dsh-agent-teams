# DSH 0.2.1-alpha.1 source compatibility (local dev-portable)

Target: `/home/xuxw/gitcode/self-deepseek/deepseek-harness/` at `5badb15009ae1756c3afe0ae0cef1faafc290ccc`. This is an exact source candidate, not an npm release or ordinary-user recommendation.

- Source adapted to producer-owned `plugin:@nanmicoder/dsh-agent-teams` message source and `uiSession.adapter.current.getSnapshot().key`; the old `{kind:'plugin', plugin:...}` source and `props.sessionId` do not match this host.
- Frozen 0.2.0-rc.2 dependencies: `pnpm run typecheck`, `pnpm run build`, and `pnpm verify` passed after semantic merge. The source-candidate declaration preserves that published development baseline.
- An isolated test tgz with only the 21 exact DSH peer ranges appended with `0.2.1-alpha.1` installed through the target DSH official CLI without exemption. Host Fiber `agent-teams` reached ACTIVE; Playwright opened Web UI and left boot screen with no console errors.
- These checks do not prove real multi-agent dispatch, model routes, restored historical sessions, or Windows Portable behavior. Legacy `scripts/session-source-repair.mjs` is for old JSONL only, not v4; never run it against the real profile without separate backup and validation.
