import type { ChatMessage } from '../../../core/models';

export interface ChatMessageGroup {
  key: string;
  date: string;
  messages: ChatMessage[];
}

export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const message of [...current, ...incoming]) {
    const key = message.sequence > 0 ? `sequence:${message.sequence}` : `id:${message.id}`;
    messages.set(key, message);
  }
  return [...messages.values()].sort((left, right) => left.sequence - right.sequence || Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

export function groupChatMessages(messages: ChatMessage[]): ChatMessageGroup[] {
  const groups = new Map<string, ChatMessageGroup>();
  for (const message of messages) {
    const date = message.createdAt.slice(0, 10) || 'recentes';
    const group = groups.get(date) ?? { key: date, date: message.createdAt, messages: [] };
    group.messages.push(message);
    groups.set(date, group);
  }
  return [...groups.values()];
}

export function isNearChatBottom(scrollTop: number, clientHeight: number, scrollHeight: number, threshold = 96): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
