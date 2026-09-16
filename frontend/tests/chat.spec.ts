import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatMessage } from '../src/app/core/models/index.ts';
import { shouldSendComposerMessage } from '../src/app/features/messaging/utils/chat-composer.util.ts';
import { groupChatMessages, isNearChatBottom, mergeChatMessages } from '../src/app/features/messaging/utils/chat.util.ts';

const message = (id: string, sequence: number, createdAt: string): ChatMessage => ({ id, sequence, senderId: 'user', senderName: 'Usuário', body: id, messageType: 'text', createdAt });

describe('chat utilities', () => {
  it('une mensagens sem repetir sequência e mantém a ordem', () => {
    const merged = mergeChatMessages([message('old', 1, '2026-09-01T10:00:00Z'), message('stale', 2, '2026-09-01T10:01:00Z')], [message('updated', 2, '2026-09-01T10:01:02Z'), message('new', 3, '2026-09-01T10:02:00Z')]);
    assert.deepEqual(merged.map((item) => item.id), ['old', 'updated', 'new']);
    const withoutSequence = mergeChatMessages(
      [message('later', 0, '2026-09-02T10:00:00Z')],
      [message('earlier', 0, '2026-09-01T10:00:00Z')]
    );
    assert.deepEqual(withoutSequence.map((item) => item.id), ['earlier', 'later']);
  });

  it('agrupa mensagens por dia para os separadores da conversa', () => {
    const sameDay = message('same-day', 3, '2026-09-02T12:00:00Z');
    const missingDate = message('recent', 4, '');
    const groups = groupChatMessages([message('a', 1, '2026-09-01T23:50:00Z'), message('b', 2, '2026-09-02T00:10:00Z'), sameDay, missingDate]);
    assert.deepEqual(groups.map((group) => [group.key, group.messages.length]), [['2026-09-01', 1], ['2026-09-02', 2], ['recentes', 1]]);
  });

  it('só fixa a rolagem quando o usuário está perto da última mensagem', () => {
    assert.equal(isNearChatBottom(850, 100, 1000), true);
    assert.equal(isNearChatBottom(400, 100, 1000), false);
  });

  it('preserva Enter para nova linha e exige atalho explícito para enviar', () => {
    assert.equal(shouldSendComposerMessage({ key: 'a', ctrlKey: false, metaKey: false, isComposing: false }), false);
    assert.equal(shouldSendComposerMessage({ key: 'Enter', ctrlKey: false, metaKey: false, isComposing: true }), false);
    assert.equal(shouldSendComposerMessage({ key: 'Enter', ctrlKey: false, metaKey: false, isComposing: false }), false);
    assert.equal(shouldSendComposerMessage({ key: 'Enter', ctrlKey: true, metaKey: false, isComposing: false }), true);
    assert.equal(shouldSendComposerMessage({ key: 'Enter', ctrlKey: false, metaKey: true, isComposing: false }), true);
  });
});
