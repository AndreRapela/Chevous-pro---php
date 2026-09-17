import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subject, finalize, map, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ChatMessage, Conversation } from '../../../../core/models';
import { AvatarComponent, PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';
import { ConversationSyncService } from '../../data-access/conversation-sync.service';
import { normalizeComposerMessage, shouldSendComposerMessage } from '../../utils/chat-composer.util';
import { groupChatMessages, isNearChatBottom, mergeChatMessages } from '../../utils/chat.util';
import { mergeUniqueById, pageFromMeta, totalFromMeta } from '../../../../shared/utils/pagination.util';

@Component({
  selector: 'cvp-messages',
  standalone: true,
  imports: [AvatarComponent, LocalizedDatePipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page messages-page">
      <cvp-page-header eyebrow="Conversa protegida" title="Mensagens" description="Alinhe detalhes da reserva com segurança, sem compartilhar seus dados de contato." />
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Mensagens indisponíveis" [message]="error()" (retry)="load()" /> }
      @else if (!conversations().length) { <cvp-state-panel kind="empty" title="Nenhuma conversa ainda" message="Abra um perfil profissional para iniciar uma conversa antes de agendar." /> }
      @else {
        <div class="chat-layout enhanced-chat-layout" [class.chat-has-selection]="!!selected()">
          <aside class="conversation-list" aria-label="Conversas">
            <div class="conversation-list-heading"><strong>Suas conversas</strong><span>{{ conversationTotal() }}</span></div>
            <div class="conversation-list-items">@for (conversation of conversations(); track conversation.id) {
              <button type="button" [class.active]="selected()?.id === conversation.id" (click)="select(conversation)" [attr.aria-current]="selected()?.id === conversation.id ? 'true' : null">
                <cvp-avatar data-cvp-no-localize [initials]="initials(contactName(conversation))" [imageUrl]="conversation.contactAvatarUrl" [label]="contactName(conversation)" />
                <span data-cvp-no-localize><strong>{{ contactName(conversation) }}</strong><small>{{ conversation.serviceName }} · {{ conversation.lastMessage }}</small></span>
                <span class="message-meta"><time>{{ conversation.updatedAt | appDate:'MMM d, HH:mm' }}</time>@if (conversation.unreadCount) { <b [attr.aria-label]="conversation.unreadCount + ' mensagens não lidas'">{{ conversation.unreadCount }}</b> }</span>
              </button>
            }</div>@if (conversationPage() < conversationLastPage()) { <div class="conversation-list-more"><button class="btn btn-secondary btn-small" type="button" [disabled]="loadingMoreConversations()" (click)="loadMoreConversations()">{{ loadingMoreConversations() ? 'Carregando…' : 'Ver conversas anteriores' }}</button></div> }
          </aside>
          <section class="chat-panel" aria-label="Conversa selecionada">
            @if (selected(); as conversation) {
              <header class="chat-header"><button class="chat-back-to-list" type="button" (click)="backToConversations()">Conversas</button><cvp-avatar data-cvp-no-localize [initials]="initials(contactName(conversation))" [imageUrl]="conversation.contactAvatarUrl" [label]="contactName(conversation)" /><div data-cvp-no-localize><strong>{{ contactName(conversation) }}</strong><small>{{ conversation.serviceName }}</small></div><span class="chat-live-status" [attr.data-state]="connectionState()"><span aria-hidden="true">●</span> {{ connectionStatusLabel() }}</span><span class="booking-chat-status" [attr.data-status]="conversation.bookingStatus">{{ bookingStatusLabel(conversation.bookingStatus) }}</span></header>
              <p class="sr-only" aria-live="polite">{{ liveAnnouncement() }}</p>
              <div #chatBody class="chat-body" (scroll)="onChatScroll()">
                @if (hasOlderMessages()) { <button class="chat-load-older" type="button" [disabled]="loadingOlder()" (click)="loadOlderMessages()">{{ loadingOlder() ? 'Carregando histórico…' : 'Carregar mensagens anteriores' }}</button> }
                @if (loadingMessages()) { <p class="chat-empty-state">Carregando conversa…</p> }
                @else if (!chatMessages().length) { <div class="chat-empty-state"><strong>Conversa iniciada</strong><span>Use este espaço para alinhar acesso, detalhes e expectativas do serviço.</span></div> }
                @else { @for (group of messageGroups(); track group.key) { <p class="chat-day">{{ group.date | appDate:'EEEE, d MMM' }}</p>@for (message of group.messages; track message.id) { <div class="bubble" [class.sent]="message.senderId === auth.user()?.id" [class.received]="message.senderId !== auth.user()?.id"><strong data-cvp-no-localize>{{ message.senderId === auth.user()?.id ? 'Você' : message.senderName }}</strong><span data-cvp-no-localize>{{ message.body }}</span><time>{{ message.createdAt | appDate:'HH:mm' }}</time></div> } } }
              </div>
              <div class="chat-safety-note"><span aria-hidden="true">⌁</span> Use o chat para alinhar detalhes do serviço e proteja suas informações pessoais.</div>
              <form class="chat-composer enhanced-chat-composer" (submit)="send($event)">
                <div class="quick-replies" aria-label="Respostas rápidas">@for (reply of quickReplies; track reply) { <button type="button" [disabled]="sending() || !canSendMessage(conversation)" (click)="sendQuickReply(reply)">{{ reply }}</button> }</div>
                <label class="sr-only" for="chat-message">Mensagem</label><textarea id="chat-message" name="body" maxlength="4000" required [disabled]="!canSendMessage(conversation)" [placeholder]="canSendMessage(conversation) ? 'Escreva uma mensagem…' : 'Este chat não aceita novas mensagens.'" [value]="draft()" (input)="updateDraft($any($event.target).value)" (keydown.enter)="onComposerKeydown($event)"></textarea><div class="composer-actions"><small>{{ canSendMessage(conversation) ? draft().length + '/4000 · Ctrl/Cmd + Enter envia · Enter quebra linha' : 'A reserva foi encerrada e o histórico permanece disponível.' }}</small><button class="btn btn-primary btn-small" type="submit" [disabled]="sending() || !draft().trim() || !canSendMessage(conversation)" aria-label="Enviar mensagem">{{ sending() ? 'Enviando…' : 'Enviar' }}</button></div>@if (messageError()) { <span class="field-error chat-message-error" role="alert">{{ messageError() }}</span> }@if (syncError()) { <span class="chat-sync-error" role="status">{{ syncError() }}</span> }
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
  @ViewChild('chatBody') private chatBody?: ElementRef<HTMLElement>;
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
  private shouldStickToBottom = true;
  private oldestSequence = 0;
  private readonly messagePageSize = 50;
  private pendingMessageKey: string | null = null;

  readonly auth = inject(AuthService);
  readonly conversations = signal<Conversation[]>([]);
  readonly conversationPage = signal(1);
  readonly conversationLastPage = signal(1);
  readonly conversationTotal = signal(0);
  readonly loadingMoreConversations = signal(false);
  readonly selected = signal<Conversation | null>(null);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly messageGroups = computed(() => groupChatMessages(this.chatMessages()));
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly loadingMessages = signal(false);
  readonly loadingOlder = signal(false);
  readonly hasOlderMessages = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly messageError = signal('');
  readonly syncError = signal('');
  readonly connectionState = signal<'connecting' | 'live' | 'reconnecting'>('connecting');
  readonly liveAnnouncement = signal('');
  readonly quickReplies = ['Olá! Confirmo o horário combinado.', 'Pode me informar mais detalhes?', 'Perfeito, obrigado!'];

  ngOnInit(): void {
    this.requestedConversationId = this.route.snapshot.queryParamMap.get('conversa') ?? '';
    this.sync.watchConversations(this.conversationRefresh).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((batch) => {
      if (batch.error) { this.loading.set(false); if (!this.conversations().length) this.error.set(batch.error.message); return; }
      this.loading.set(false); this.error.set(''); this.conversationPage.set(Math.max(this.conversationPage(), batch.page)); this.conversationLastPage.set(batch.lastPage); this.conversationTotal.set(batch.total);
      const conversations = mergeUniqueById(batch.conversations, this.conversations());
      this.conversations.set(conversations);
      const currentId = this.selected()?.id; const current = conversations.find((conversation) => conversation.id === currentId);
      if (current) this.selected.set(current);
      else if (conversations[0]) { this.select(conversations.find((conversation) => conversation.id === this.requestedConversationId) ?? conversations[0]); this.requestedConversationId = ''; }
      else { this.selected.set(null); this.chatMessages.set([]); }
    });
    this.conversationSelection.pipe(switchMap((conversationId) => conversationId ? this.sync.watchMessages(conversationId).pipe(map((batch) => ({ conversationId, batch }))) : EMPTY), takeUntilDestroyed(this.destroyRef)).subscribe(({ conversationId, batch }) => {
      if (conversationId !== this.selected()?.id) return; this.loadingMessages.set(false);
      if (batch.error) { this.connectionState.set('reconnecting'); this.syncError.set('Conexão instável. Tentando sincronizar novamente…'); return; }
      this.connectionState.set('live'); this.syncError.set('');
      if (batch.initial) this.hasOlderMessages.set(batch.messages.length === this.messagePageSize);
      this.applyMessages(conversationId, batch.messages, batch.initial, batch.initial);
    });
  }

  load(): void { this.loading.set(true); this.error.set(''); this.conversationRefresh.next(); }
  loadMoreConversations(): void {
    const nextPage = this.conversationPage() + 1;
    if (this.loadingMoreConversations() || nextPage > this.conversationLastPage()) return;
    this.loadingMoreConversations.set(true);
    this.marketplace.conversationsPage({ page: nextPage, perPage: 30 }).pipe(finalize(() => this.loadingMoreConversations.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.conversations.update((items) => mergeUniqueById(items, response.data));
        this.conversationPage.set(pageFromMeta(response.meta, 'page'));
        this.conversationLastPage.set(pageFromMeta(response.meta, 'lastPage'));
        this.conversationTotal.set(totalFromMeta(response.meta));
      },
      error: (failure: Error) => this.syncError.set(failure.message)
    });
  }
  select(conversation: Conversation): void { this.selected.set(conversation); this.chatMessages.set([]); this.draft.set(''); this.pendingMessageKey = null; this.loadingMessages.set(true); this.loadingOlder.set(false); this.hasOlderMessages.set(false); this.messageError.set(''); this.syncError.set(''); this.connectionState.set('connecting'); this.liveAnnouncement.set(''); this.oldestSequence = 0; this.acknowledgedSequence = 0; this.readPending = false; this.pendingReadSequence = 0; this.shouldStickToBottom = true; this.conversationSelection.next(conversation.id); }
  backToConversations(): void { this.selected.set(null); this.chatMessages.set([]); this.draft.set(''); this.pendingMessageKey = null; this.hasOlderMessages.set(false); this.connectionState.set('connecting'); this.conversationSelection.next(''); }
  send(event: Event): void { event.preventDefault(); this.sendMessage(this.draft(), true); }
  onComposerKeydown(event: Event): void { const keyboardEvent = event as KeyboardEvent; if (shouldSendComposerMessage(keyboardEvent)) { keyboardEvent.preventDefault(); this.send(keyboardEvent); } }
  updateDraft(value: string): void { this.pendingMessageKey = null; this.draft.set(value); }
  sendQuickReply(reply: string): void { this.pendingMessageKey = null; this.sendMessage(reply, false); }
  onChatScroll(): void { const body = this.chatBody?.nativeElement; if (body) this.shouldStickToBottom = isNearChatBottom(body.scrollTop, body.clientHeight, body.scrollHeight); }
  loadOlderMessages(): void {
    const conversation = this.selected();
    if (!conversation || !this.oldestSequence || this.loadingOlder()) return;
    const body = this.chatBody?.nativeElement;
    const previousHeight = body?.scrollHeight ?? 0;
    const previousTop = body?.scrollTop ?? 0;
    this.loadingOlder.set(true);
    this.marketplace.conversationMessages(conversation.id, { before: this.oldestSequence, limit: this.messagePageSize }).pipe(
      finalize(() => this.loadingOlder.set(false)), takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (messages) => {
        this.chatMessages.set(mergeChatMessages(this.chatMessages(), messages));
        this.oldestSequence = this.chatMessages()[0]?.sequence ?? 0;
        this.hasOlderMessages.set(messages.length === this.messagePageSize);
        setTimeout(() => { if (body) body.scrollTop = previousTop + body.scrollHeight - previousHeight; }, 0);
      },
      error: (failure: Error) => this.syncError.set(failure.message)
    });
  }
  initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase(); }
  contactName(conversation: Conversation): string { return conversation.contactName || conversation.serviceName || 'Contato da reserva'; }
  canSendMessage(conversation: Conversation): boolean { return ['inquiry', 'confirmed', 'provider_on_the_way', 'in_progress', 'completed', 'disputed'].includes(conversation.bookingStatus); }
  connectionStatusLabel(): string { return ({ connecting: 'Conectando…', live: 'Sincronizado', reconnecting: 'Reconectando…' } as const)[this.connectionState()]; }
  bookingStatusLabel(status: string): string { return ({ inquiry: 'Contato antes da reserva', confirmed: 'Reserva confirmada', provider_on_the_way: 'A caminho', in_progress: 'Em andamento', completed: 'Serviço concluído', disputed: 'Em análise', cancelled: 'Reserva cancelada', awaiting_confirmation: 'Aguardando confirmação', open: 'Aguardando profissional' } as Record<string, string>)[status] ?? 'Reserva em andamento'; }

  private applyMessages(conversationId: string, incoming: ChatMessage[], forceScroll = false, initialLoad = false): void {
    if (conversationId !== this.selected()?.id) return;
    const existing = this.chatMessages(); const merged = mergeChatMessages(existing, incoming); const latest = merged.at(-1); this.chatMessages.set(merged);
    this.oldestSequence = merged[0]?.sequence ?? 0;
    if (!initialLoad && incoming.some((message) => message.senderId !== this.auth.user()?.id)) this.liveAnnouncement.set('Nova mensagem recebida.');
    if (!latest) return;
    const preview = (conversation: Conversation): Conversation => ({ ...conversation, lastMessage: latest.body, updatedAt: latest.createdAt, unreadCount: 0 });
    this.conversations.update((items) => items.map((conversation) => conversation.id === conversationId ? preview(conversation) : conversation).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)));
    this.selected.update((conversation) => conversation?.id === conversationId ? preview(conversation) : conversation);
    const latestIncoming = [...merged].reverse().find((message) => message.senderId !== this.auth.user()?.id);
    if (latestIncoming) this.acknowledgeRead(conversationId, latestIncoming.sequence);
    if (forceScroll || this.shouldStickToBottom) setTimeout(() => this.scrollToBottom(), 0);
  }
  private scrollToBottom(): void { const body = this.chatBody?.nativeElement ?? this.document.querySelector<HTMLElement>('.chat-body'); if (body) body.scrollTop = body.scrollHeight; }
  private sendMessage(value: string, clearDraft: boolean): void {
    const conversation = this.selected(); const body = normalizeComposerMessage(value);
    if (!conversation || !this.canSendMessage(conversation) || !body || this.sending()) return;
    const idempotencyKey = this.pendingMessageKey ?? this.createMessageKey(); this.pendingMessageKey = idempotencyKey; this.sending.set(true); this.messageError.set('');
    this.marketplace.sendMessage(conversation.id, body, idempotencyKey).pipe(finalize(() => this.sending.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (message) => { this.applyMessages(conversation.id, [message], true); if (clearDraft) this.draft.set(''); this.pendingMessageKey = null; },
      error: (failure: Error) => this.messageError.set(failure.message)
    });
  }
  private createMessageKey(): string { return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  private acknowledgeRead(conversationId: string, sequence: number): void { if (!sequence || sequence <= this.acknowledgedSequence) return; if (this.readPending) { this.pendingReadSequence = Math.max(this.pendingReadSequence, sequence); return; } this.readPending = true; this.marketplace.markConversationRead(conversationId, sequence).pipe(finalize(() => { this.readPending = false; const pending = this.pendingReadSequence; this.pendingReadSequence = 0; if (pending > this.acknowledgedSequence && conversationId === this.selected()?.id) this.acknowledgeRead(conversationId, pending); }), takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { if (conversationId === this.selected()?.id) this.acknowledgedSequence = Math.max(this.acknowledgedSequence, sequence); }, error: () => undefined }); }
}
