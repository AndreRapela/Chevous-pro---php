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
  expand,
  fromEvent,
  map,
  merge,
  of,
  reduce,
  startWith,
  switchMap,
  tap,
  timer
} from 'rxjs';
import { MarketplaceService } from '../../../core/data-access/marketplace.service';
import { ChatMessage, Conversation } from '../../../core/models';

const MESSAGE_PAGE_SIZE = 100;
const MESSAGE_POLL_INTERVAL_MS = 2_000;
const CONVERSATION_POLL_INTERVAL_MS = 10_000;

export interface ConversationMessageBatch {
  messages: ChatMessage[];
  initial: boolean;
  error?: Error;
}

export interface ConversationListBatch {
  conversations: Conversation[];
  initial: boolean;
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

      return this.visibleTicks(MESSAGE_POLL_INTERVAL_MS).pipe(
        exhaustMap(() => this.messagesAfter(conversationId, cursor).pipe(
          map((messages): ConversationMessageBatch => {
            cursor = Math.max(cursor, ...messages.map((message) => message.sequence));
            return { messages, initial };
          }),
          catchError((failure: unknown) => of({ messages: [], initial, error: this.toError(failure) }))
        )),
        tap((batch) => {
          if (!batch.error) initial = false;
        })
      );
    });
  }

  watchConversations(refresh: Observable<unknown> = EMPTY): Observable<ConversationListBatch> {
    return defer(() => {
      let initial = true;

      return this.visibleTicks(CONVERSATION_POLL_INTERVAL_MS, refresh).pipe(
        exhaustMap(() => this.marketplace.conversations().pipe(
          map((conversations): ConversationListBatch => ({ conversations, initial })),
          catchError((failure: unknown) => of({ conversations: [], initial, error: this.toError(failure) }))
        )),
        tap((batch) => {
          if (!batch.error) initial = false;
        })
      );
    });
  }

  private messagesAfter(conversationId: string, after: number): Observable<ChatMessage[]> {
    return this.marketplace.conversationMessages(conversationId, { after, limit: MESSAGE_PAGE_SIZE }).pipe(
      expand((messages) => messages.length === MESSAGE_PAGE_SIZE
        ? this.marketplace.conversationMessages(conversationId, {
            after: messages.at(-1)?.sequence ?? after,
            limit: MESSAGE_PAGE_SIZE
          })
        : EMPTY
      ),
      reduce((all, messages) => [...all, ...messages], [] as ChatMessage[])
    );
  }

  private visibleTicks(intervalMs: number, refresh: Observable<unknown> = EMPTY): Observable<unknown> {
    return fromEvent(this.document, 'visibilitychange').pipe(
      startWith(undefined),
      map(() => this.document.visibilityState !== 'hidden'),
      distinctUntilChanged(),
      switchMap((visible) => visible
        ? merge(of(undefined), timer(intervalMs, intervalMs), refresh)
        : NEVER
      )
    );
  }

  private toError(failure: unknown): Error {
    return failure instanceof Error ? failure : new Error('Não foi possível sincronizar as mensagens.');
  }
}
