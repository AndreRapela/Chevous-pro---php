import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHAT_MAX_RETRY_DELAY_MS, CHAT_RETRY_DELAY_MS, nextChatRetryDelay } from '../src/app/features/messaging/utils/chat-sync.util.ts';

describe('backoff da sincronização do chat', () => {
  it('inicia uma espera curta depois da primeira falha', () => {
    assert.equal(nextChatRetryDelay(0), CHAT_RETRY_DELAY_MS);
    assert.equal(nextChatRetryDelay(-1), CHAT_RETRY_DELAY_MS);
  });

  it('faz backoff limitado em falhas consecutivas', () => {
    assert.equal(nextChatRetryDelay(CHAT_RETRY_DELAY_MS), CHAT_RETRY_DELAY_MS * 2);
    assert.equal(nextChatRetryDelay(CHAT_MAX_RETRY_DELAY_MS), CHAT_MAX_RETRY_DELAY_MS);
  });
});
