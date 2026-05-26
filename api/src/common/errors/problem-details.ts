import { HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

const PROBLEM_BASE = 'https://api.teamcollab.io/errors';

export const ProblemTypes = {
  validation: { type: `${PROBLEM_BASE}/validation-error`, title: 'Validation Error' },
  badRequest: { type: `${PROBLEM_BASE}/bad-request`, title: 'Bad Request' },
  authentication: { type: `${PROBLEM_BASE}/authentication-error`, title: 'Authentication Error' },
  authorization: { type: `${PROBLEM_BASE}/authorization-error`, title: 'Authorization Error' },
  notFound: { type: `${PROBLEM_BASE}/resource-not-found`, title: 'Resource Not Found' },
  conflict: { type: `${PROBLEM_BASE}/conflict-error`, title: 'Conflict' },
  unprocessable: {
    type: `${PROBLEM_BASE}/unprocessable-entity`,
    title: 'Unprocessable Entity',
  },
  rateLimited: { type: `${PROBLEM_BASE}/rate-limit-exceeded`, title: 'Rate Limit Exceeded' },
  internal: { type: `${PROBLEM_BASE}/internal-error`, title: 'Internal Error' },
} as const;

export function statusToProblemMeta(status: number): { type: string; title: string } {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ProblemTypes.badRequest;
    case HttpStatus.UNAUTHORIZED:
      return ProblemTypes.authentication;
    case HttpStatus.FORBIDDEN:
      return ProblemTypes.authorization;
    case HttpStatus.NOT_FOUND:
      return ProblemTypes.notFound;
    case HttpStatus.CONFLICT:
      return ProblemTypes.conflict;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ProblemTypes.unprocessable;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ProblemTypes.rateLimited;
    default:
      return ProblemTypes.internal;
  }
}
