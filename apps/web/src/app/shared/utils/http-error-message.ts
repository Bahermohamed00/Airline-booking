// Maps HttpClient error responses to user-facing messages. The caller's
// `fallback` covers network/5xx/unknown failures; `conflictMessage` lets each
// page phrase 409s for its own uniqueness rule (duplicate IATA code, tail
// number, route pair, …).

interface HttpErrorLike {
  status?: number;
  error?: { message?: string | string[] };
}

export function toErrorMessage(err: unknown, fallback: string, conflictMessage?: string): string {
  const status = (err as HttpErrorLike | null)?.status;
  if (status === 400) {
    const message = (err as HttpErrorLike).error?.message;
    return Array.isArray(message)
      ? message.join(' ')
      : (message ?? 'The submitted data is invalid.');
  }
  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 404) {
    return 'The requested record was not found.';
  }
  if (status === 409) {
    return conflictMessage ?? 'This conflicts with an existing record.';
  }
  return fallback;
}

/** Extracts the API's displayable `error.message` body when present (402/409
 *  payment bodies are safe to show per the payments API contract). */
export function serverMessage(err: unknown): string | null {
  const message = (err as HttpErrorLike | null)?.error?.message;
  return Array.isArray(message) ? message.join(' ') : (message ?? null);
}
