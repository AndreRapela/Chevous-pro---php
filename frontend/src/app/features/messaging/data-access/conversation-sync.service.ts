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

      return this.visibleState().pipe(
        switchMap((visible) => visible
          ? defer(nextBatch).pipe(repeat({ delay: () => timer(nextDelay) }))
          : NEVER
        )
      );
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
