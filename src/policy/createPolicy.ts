import type { AuthPolicy, PolicyDecision } from "../core/types";

export type PolicyEvaluator<User, Session> = (
  user: User | null,
  action: string,
  context: unknown,
  session: Session | null,
) => PolicyDecision;

export function createPolicy<User, Session = unknown>(
  evaluator: PolicyEvaluator<User, Session>,
): AuthPolicy<User, Session> {
  return {
    evaluate: evaluator,
  };
}
