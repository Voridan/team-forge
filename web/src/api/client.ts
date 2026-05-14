import type { ApiEnvelope, ProblemDetails } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class ApiError extends Error {
  public readonly problem: ProblemDetails;
  public readonly status: number;

  constructor(problem: ProblemDetails, status: number) {
    super(problem.detail ?? problem.title);

    this.problem = problem;
    this.status = status;
  }

  fieldErrorFor(field: string): string | undefined {
    return this.problem.errors?.find((e) => e.field === field)?.message;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

interface AuthHandlers {
  getAccessToken: () => string | null;
  refresh: () => Promise<string>;
  onUnauthorized: () => void;
}

let authHandlers: AuthHandlers | null = null;

export function configureAuth(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

let refreshInFlight: Promise<string> | null = null;

async function ensureFreshToken(): Promise<string | null> {
  if (!authHandlers) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = authHandlers.refresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers: rawHeaders, ...rest } = options;
  const headers = new Headers(rawHeaders);

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && authHandlers) {
    const token = authHandlers.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;
  const requestInit: RequestInit = {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response = await fetch(url, requestInit);

  if (response.status === 401 && auth && authHandlers) {
    try {
      const newToken = await ensureFreshToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        response = await fetch(url, { ...requestInit, headers });
      }
    } catch {
      authHandlers.onUnauthorized();
      throw await toApiError(response);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    if (response.status === 401 && authHandlers) {
      authHandlers.onUnauthorized();
    }
    throw await toApiError(response);
  }

  const json = (await response.json()) as ApiEnvelope<T> | T;
  return unwrapEnvelope<T>(json);
}

function unwrapEnvelope<T>(json: ApiEnvelope<T> | T): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails;
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    problem = {
      type: "about:blank",
      title: response.statusText || "Request Failed",
      status: response.status,
    };
  }
  return new ApiError(problem, response.status);
}
