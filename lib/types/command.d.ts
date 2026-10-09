import type { Context } from '@deepseek-ai/cordis';
import { type UserMessage } from '@deepseek-ai/dsh-llm';
import { type TeamProfileConfig, type AgentTeamsInvocation } from './profiles.ts';
export declare const AGENT_TEAMS_COMMAND = "agent-teams";
/** Producer-owned source for model-visible AgentTeams context. */
export declare const AGENT_TEAMS_CONTEXT_SOURCE: Readonly<{
    kind: "plugin:@nanmicoder/dsh-agent-teams";
    form: "instructions";
}>;
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        'plugin:@nanmicoder/dsh-agent-teams': typeof AGENT_TEAMS_CONTEXT_SOURCE;
    }
}
/**
 * Convert a configured profile key into a stable, closed-namespace command
 * suffix. Only lowercase ASCII letters, digits and dashes are representable;
 * this deliberately prevents accidental command aliases for ambiguous profile
 * names such as `foo bar`, `foo_bar`, or non-ASCII keys.
 */
export declare function profileCommandName(profileName: string): string | undefined;
export declare function invokedAgentTeamsInvocation(messages: readonly UserMessage[], getProfiles?: () => Record<string, TeamProfileConfig>): AgentTeamsInvocation | undefined;
export declare function invokedAgentTeamsGoal(messages: readonly UserMessage[]): string | undefined;
export declare function buildActivationDirective(goal: string, profile?: string, taskPlanning?: 'captain' | 'seed'): string;
export declare function registerAgentTeamsCommand(ctx: Context, getProfiles?: () => Record<string, TeamProfileConfig>): void;
export declare function installAgentTeamsGestureBoundary(ctx: Context, getProfiles?: () => Record<string, TeamProfileConfig>): void;
