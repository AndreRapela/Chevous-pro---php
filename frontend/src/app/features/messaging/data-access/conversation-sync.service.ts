import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import {
  EMPTY,
  NEVER,
  Observable,
  catchError,
  defer,
  distinctUntilChanged,
  exhaustMap,
  fromEvent,
  map,
  merge,
  of,
  repeat,
  startWith,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { MarketplaceService } from '../../../core/data-access/marketplace.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ChatMessage, Conversation } from '../../../core/models';
import { pageFromMeta, totalFromMeta } from '../../../shared/utils/pagination.util';
import { nextChatRetryDelay } from '../utils/chat-sync.util';

// Uma página pequena mantém o primeiro acesso rápido em redes móveis. O
// histórico anterior é solicitado explicitamente pela tela, nunca drenado todo.
const MESSAGE_PAGE_SIZE = 50;
// Atualização incremental de curta duração: reduz carga em redes móveis e no
// banco sem deixar a conversa parecer parada. Mensagens enviadas localmente
// entram imediatamente na tela; o ciclo confirma mensagens recebidas.
const MESSAGE_POLL_INTERVAL_MS = 10_000;
const CONVERSATION_POLL_INTERVAL_MS = 60_000;

export interface ConversationMessageBatch {
  messages: ChatMessage[];
  initial: boolean;
  error?: Error;
}

export interface ConversationListBatch {
  conversations: Conversation[];
  initial: boolean;
  page: number;
  lastPage: number;
  total: number;
  error?: Error;
}

@Injectable({ providedIn: 'root' })
export class ConversationSyncService {
  private readonly document = inject(DOCUMENT);
  private readonly marketplace = inject(MarketplaceService);
  private readonly auth = inject(AuthService);

  watchMessages(conversationId: string): Observable<ConversationMessageBatch> {
    return defer(() => {
      let cursor = 0;
      let initial = true;
      let nextDelay = 0;

      const nextBatch = () => (initial
          ? this.messagesLatest(conversationId)
          : this.messagesAfter(conversationId, cursor)
      ).pipe(
          map((messages): ConversationMessageBatch => {
            cursor = Math.max(cursor, ...messages.map((message) => message.sequence));
            return { messages, initial };
          }),
          catchError((failure: unknown) => {
            nextDelay = nextChatRetryDelay(nextDelay);
            return of({ messages: [], initial, error: this.toError(failure) });
          }),
          tap((batch) => {
            if (!batch.error) {
              initial = false;
              nextDelay = MESSAGE_POLL_INTERVAL_MS;
            }
          })
        );

      const fallback = this.visibleState().pipe(
        switchMap((visible) => visible
          ? defer(nextBatch).pipe(repeat({ delay: () => timer(nextDelay) }))
          : NEVER
        )
      );
      // SSE entrega imediatamente; a consulta incremental continua como
      // contingência para proxies corporativos que não aceitam streaming.
      // A conexão também é abortada em segundo plano para não gastar bateria
      // e workers enquanto a conversa não está visível.
      const realtime = this.visibleState().pipe(
        switchMap((visible) => visible ? this.liveStream(conversationId, () => cursor) : NEVER),
        map((message): ConversationMessageBatch => { cursor = Math.max(cursor, message.sequence); return { messages: [message], initial: false }; }),
        catchError(() => EMPTY)
      );
      return merge(fallback, realtime);
    });
  }

  watchConversations(refresh: Observable<unknown> = EMPTY): Observable<ConversationListBatch> {
    return defer(() => {
      let initial = true;

      return this.visibleTicks(CONVERSATION_POLL_INTERVAL_MS, refresh).pipe(
        exhaustMap(() => this.marketplace.conversationsPage().pipe(
          map((response): ConversationListBatch => ({ conversations: response.data, initial, page: pageFromMeta(response.meta, 'page'), lastPage: pageFromMeta(response.meta, 'lastPage'), total: totalFromMeta(response.meta) })),
          catchError((failure: unknown) => of({ conversations: [], initial, page: 1, lastPage: 1, total: 0, error: this.toError(failure) }))
        )),
        tap((batch) => {
          if (!batch.error) initial = false;
        })
      );
    });
  }

  private messagesLatest(conversationId: string): Observable<ChatMessage[]> {
    return this.marketplace.conversationMessages(conversationId, {
      before: Number.MAX_SAFE_INTEGER,
      limit: MESSAGE_PAGE_SIZE
    });
  }

  private messagesAfter(conversationId: string, after: number): Observable<ChatMessage[]> {
    return this.marketplace.conversationMessageUpdates(conversationId, after);
  }

  private liveStream(conversationId: string, cursor: () => number): Observable<ChatMessage> {
    return new Observable<ChatMessage>((subscriber) => {
      let stopped = false;
      let controller: AbortController | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      const connect = async (): Promise<void> => {
        const token = this.auth.accessToken();
        if (!token || stopped) { subscriber.complete(); return; }
        controller = new AbortController();
        try {
          const response = await fetch(`/api/v1/conversations/${encodeURIComponent(conversationId)}/stream?after=${cursor()}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, credentials: 'same-origin', signal: controller.signal
          });
          if (!response.ok || !response.body) throw new Error('Fluxo em tempo real indisponível.');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!stopped) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const events = buffer.split('\n\n'); buffer = events.pop() ?? '';
            for (const event of events) {
              const data = event.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
              if (!data || data === '{}') continue;
              const rawMessage = JSON.parse(data) as ChatMessage;
              const message: ChatMessage = { ...rawMessage, sequence: Number(rawMessage.sequence) };
              if (message.id && Number.isFinite(message.sequence)) subscriber.next(message);
            }
          }
          if (!stopped) void connect();
        } catch (failure) {
          if (!stopped && failure instanceof DOMException && failure.name === 'AbortError') return;
          // O polling autenticado continua como contingência. Tentar de novo
          // permite que o stream volte logo após uma renovação de sessão ou um
          // proxy temporariamente indisponível, sem sobrepor conexões.
          if (!stopped) reconnectTimer = setTimeout(() => void connect(), 3000);
        }
      };
      void connect();
      return () => { stopped = true; controller?.abort(); if (reconnectTimer) clearTimeout(reconnectTimer); };
    });
  }

  private visibleTicks(intervalMs: number, refresh: Observable<unknown> = EMPTY): Observable<unknown> {
    return this.visibleState().pipe(
      switchMap((visible) => visible
        ? merge(of(undefined), timer(intervalMs, intervalMs), refresh)
        : NEVER
      )
    );
  }

  private visibleState(): Observable<boolean> {
    return fromEvent(this.document, 'visibilitychange').pipe(
      startWith(undefined),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged()
    );
  }

  private toError(failure: unknown): Error {
    return failure instanceof Error ? failure : new Error('Não foi possível sincronizar as mensagens.');
  }

}
