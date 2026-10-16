# DSH 0.2.1-alpha.4 source compatibility

Pinned source: `19821b6b796ee3b6bcac62e5ce11d70a423cceb2` at `/home/xuxw/gitcode/self-deepseek/deepseek-harness`. This source candidate is not a published npm recommendation.

The plugin retains the exact 0.2.0-rc.2 development dependency baseline while opting into this source candidate after source-contract checks. Profile admission, actual loader settlement, Host behavior and client behavior are distinct gates; local source tests and packaging alone do not establish runtime activation on Windows Portable.

Validation: plugin `pnpm typecheck`, `pnpm build`, and `pnpm verify` pass against the exact locked 0.2.0-rc.2 development cohort. The target source evaluator admits the packed peer metadata without exemption. An isolated lifecycle scenario against the existing alpha.4 built libraries did **not** pass: eight host entries failed to import (including both in-process subagent providers), so the member could not spawn; no Host multi-agent activation is claimed. A host `pnpm run build:lib:host` refresh was killed with exit 137 during TypeScript compilation. The target checkout was restored clean. Native Windows Portable activation and browser checks remain unverified.
