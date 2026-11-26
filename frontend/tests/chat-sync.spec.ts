import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CHAT_MAX_RETRY_DELAY_MS, CHAT_RETRY_DELAY_MS, chatPollDelay, nextChatRetryDelay } from '../src/app/features/messaging/utils/chat-sync.util.ts';

describe('cadência da sincronização do chat', () => {
  it('usa três segundos se a API não recomendar um intervalo válido', () => {
    assert.equal(chatPollDelay(undefined), 3000);
    assert.equal(chatPollDelay(NaN), 3000);
  });

  it('respeita a recomendação da API e limita os extremos', () => {
    assert.equal(chatPollDelay(5), 5000);
    assert.equal(chatPollDelay(0), 3000);
    assert.equal(chatPollDelay(60), 15000);
  });
});

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
