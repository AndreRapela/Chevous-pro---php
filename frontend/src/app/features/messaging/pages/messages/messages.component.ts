import { DOCUMENT, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subject, finalize, map, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ChatMessage, Conversation } from '../../../../core/models';
import { AvatarComponent, PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { ConversationSyncService } from '../../data-access/conversation-sync.service';

@Component({
  selector: 'cvp-messages',
  standalone: true,
  imports: [AvatarComponent, DatePipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page messages-page">
      <cvp-page-header eyebrow="Conversa protegida" title="Mensagens" description="Alinhe os detalhes sem sair da plataforma." />
      @if (loading()) {
        <cvp-state-panel kind="loading" />
      } @else if (error()) {
        <cvp-state-panel kind="error" title="Mensagens indisponíveis" [message]="error()" (retry)="load()" />
      } @else if (!conversations().length) {
        <cvp-state-panel kind="empty" title="Nenhuma conversa ainda" message="As conversas são liberadas quando você solicita um serviço." />
      } @else {
        <div class="chat-layout">
          <aside class="conversation-list" aria-label="Conversas">
            @for (conversation of conversations(); track conversation.id) {
              <button type="button" [class.active]="selected()?.id === conversation.id" (click)="select(conversation)">
                <cvp-avatar [initials]="initials(conversation.serviceName)" />
                <span><strong>{{ conversation.serviceName }}</strong><small>{{ conversation.lastMessage }}</small></span>
                <span class="message-meta">
                  <time>{{ conversation.updatedAt | date:'dd/MM HH:mm':'':'pt-BR' }}</time>
                  @if (conversation.unreadCount) { <b>{{ conversation.unreadCount }}</b> }
                </span>
              </button>
            }
          </aside>
          <section class="chat-panel">
            @if (selected(); as conversation) {
              <header>
                <cvp-avatar [initials]="initials(conversation.serviceName)" />
                <div>
                  <strong>{{ conversation.serviceName }}</strong>
                  <small>Reserva {{ conversation.bookingId }}</small>
                  @if (syncError()) { <small class="chat-sync-error" role="status">{{ syncError() }}</small> }
                </div>
              </header>
              <div class="chat-body" aria-live="polite">
                @if (loadingMessages()) {
                  <p>Carregando conversa…</p>
                } @else if (!chatMessages().length) {
                  <p>Envie a primeira mensagem desta conversa.</p>
                } @else {
                  @for (message of chatMessages(); track message.id) {
                    <div class="bubble" [class.sent]="message.senderId === auth.user()?.id" [class.received]="message.senderId !== auth.user()?.id">
                      <strong>{{ message.senderName }}</strong>{{ message.body }}
                      <time>{{ message.createdAt | date:'HH:mm':'':'pt-BR' }}</time>
                    </div>
                  }
                }
              </div>
              <form class="chat-composer" (submit)="send($event)">
                <label class="sr-only" for="chat-message">Mensagem</label>
                <input id="chat-message" name="body" maxlength="4000" required placeholder="Digite uma mensagem" [value]="draft()" (input)="draft.set($any($event.target).value)">
                <button class="btn btn-primary btn-small" type="submit" [disabled]="sending() || !draft().trim()" aria-label="Enviar mensagem">{{ sending() ? 'Enviando…' : 'Enviar' }}</button>
                @if (messageError()) { <span class="field-error chat-message-error" role="alert">{{ messageError() }}</span> }
              </form>
            }
          </section>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessagesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly sync = inject(ConversationSyncService);
  private readonly conversationRefresh = new Subject<void>();
  private readonly conversationSelection = new Subject<string>();
  private acknowledgedSequence = 0;
  private readPending = false;
  private pendingReadSequence = 0;
  private requestedConversationId = '';

  readonly auth = inject(AuthService);
  readonly conversations = signal<Conversation[]>([]);
  readonly selected = signal<Conversation | null>(null);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly messageError = signal('');
  readonly syncError = signal('');

  ngOnInit(): void {
    this.requestedConversationId = this.route.snapshot.queryParamMap.get('conversa') ?? '';
    this.sync.watchConversations(this.conversationRefresh).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((batch) => {
      if (batch.error) {
        this.loading.set(false);
        if (!this.conversations().length) this.error.set(batch.error.message);
        return;
      }

      this.loading.set(false);
      this.error.set('');
      this.conversations.set(batch.conversations);
      const currentId = this.selected()?.id;
      const current = batch.conversations.find((conversation) => conversation.id === currentId);
      if (current) {
        this.selected.set(current);
      } else if (batch.conversations[0]) {
        this.select(batch.conversations.find((conversation) => conversation.id === this.requestedConversationId) ?? batch.conversations[0]);
        this.requestedConversationId = '';
      } else {
        this.selected.set(null);
        this.chatMessages.set([]);
      }
    });

    this.conversationSelection.pipe(
      switchMap((conversationId) => this.sync.watchMessages(conversationId).pipe(
        map((batch) => ({ conversationId, batch }))
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ conversationId, batch }) => {
      if (conversationId !== this.selected()?.id) return;
      this.loadingMessages.set(false);

      if (batch.error) {
        this.syncError.set('Conexão instável. Tentando sincronizar novamente…');
        return;
      }

      this.syncError.set('');
      this.applyMessages(conversationId, batch.messages);
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.conversationRefresh.next();
  }

  select(conversation: Conversation): void {
    this.selected.set(conversation);
    this.chatMessages.set([]);
    this.loadingMessages.set(true);
    this.messageError.set('');
    this.syncError.set('');
    this.acknowledgedSequence = 0;
    this.readPending = false;
    this.pendingReadSequence = 0;
    this.conversationSelection.next(conversation.id);
  }

  send(event: Event): void {
    event.preventDefault();
    const conversation = this.selected();
    const body = this.draft().trim();
    if (!conversation || !body || this.sending()) return;

    this.sending.set(true);
    this.messageError.set('');
    this.marketplace.sendMessage(conversation.id, body).pipe(
      finalize(() => this.sending.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (message) => {
        this.applyMessages(conversation.id, [message]);
        this.draft.set('');
      },
      error: (failure: Error) => this.messageError.set(failure.message)
    });
  }

  initials(value: string): string {
    return value.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
  }

  private applyMessages(conversationId: string, incoming: ChatMessage[]): void {
    if (conversationId !== this.selected()?.id) return;

    let latest: ChatMessage | undefined;
    this.chatMessages.update((current) => {
      const messages = new Map<string, ChatMessage>();
      for (const message of [...current, ...incoming]) {
        const key = message.sequence > 0 ? `sequence:${message.sequence}` : `id:${message.id}`;
        messages.set(key, message);
      }
      const merged = [...messages.values()].sort((left, right) => left.sequence - right.sequence);
      latest = merged.at(-1);
      return merged;
    });

    if (!latest) return;
    const preview = (conversation: Conversation): Conversation => ({
      ...conversation,
      lastMessage: latest?.body ?? conversation.lastMessage,
      updatedAt: latest?.createdAt ?? conversation.updatedAt,
      unreadCount: 0
    });
    this.conversations.update((items) => items
      .map((conversation) => conversation.id === conversationId ? preview(conversation) : conversation)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    );
    this.selected.update((conversation) => conversation?.id === conversationId ? preview(conversation) : conversation);
    this.acknowledgeRead(conversationId, latest.sequence);
    setTimeout(() => { const body = this.document.querySelector<HTMLElement>('.chat-body'); if (body) body.scrollTop = body.scrollHeight; }, 0);
  }

  private acknowledgeRead(conversationId: string, sequence: number): void {
    if (!sequence || sequence <= this.acknowledgedSequence) return;
    if (this.readPending) { this.pendingReadSequence = Math.max(this.pendingReadSequence, sequence); return; }
    this.readPending = true;
    this.marketplace.markConversationRead(conversationId, sequence).pipe(
      finalize(() => {
        this.readPending = false;
        const pending = this.pendingReadSequence;
        this.pendingReadSequence = 0;
        if (pending > this.acknowledgedSequence && conversationId === this.selected()?.id) this.acknowledgeRead(conversationId, pending);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        if (conversationId === this.selected()?.id) this.acknowledgedSequence = Math.max(this.acknowledgedSequence, sequence);
      },
      error: () => undefined
    });
  }
}
