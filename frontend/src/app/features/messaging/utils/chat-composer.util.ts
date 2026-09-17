/**
 * Enter mantém a quebra de linha em teclados físicos e virtuais. O envio por
 * atalho fica reservado a Ctrl/Cmd+Enter, que não conflita com teclados móveis.
 */
export function shouldSendComposerMessage(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'isComposing'>): boolean {
  return event.key === 'Enter' && !event.isComposing && (event.ctrlKey || event.metaKey);
}

export function normalizeComposerMessage(value: string): string {
  return value.trim();
}
