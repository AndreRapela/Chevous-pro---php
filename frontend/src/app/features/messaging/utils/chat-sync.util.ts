export const CHAT_RETRY_DELAY_MS = 2_000;
export const CHAT_MAX_RETRY_DELAY_MS = 15_000;

export function chatPollDelay(pollAfterSeconds: unknown): number {
  const seconds = typeof pollAfterSeconds === 'number' && Number.isFinite(pollAfterSeconds)
    ? pollAfterSeconds
    : 3;
  return Math.min(15, Math.max(3, seconds)) * 1000;
}

/** Retarda falhas transitórias sem atrasar uma mensagem recebida normalmente. */
export function nextChatRetryDelay(currentDelay: number): number {
  return currentDelay <= 0
    ? CHAT_RETRY_DELAY_MS
    : Math.min(CHAT_MAX_RETRY_DELAY_MS, currentDelay * 2);
}
