import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, of, reduce, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiQuery, ApiService } from '../http/api.service';
import {
  Address, AppNotification, AvailabilityException, AvailabilityRule, Booking, BookingDraft, BookingOffer, BookingQuote, BookingStatus, ChatMessage,
  CheckoutResult, Conversation, DashboardMetric, PaymentIntent, ProviderDashboard, ProviderJob,
  ProviderProfile, ProviderRequest, ProviderService, PublicAvailability, Review, Service, ServiceCategory
} from '../models';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly api = inject(ApiService);

  categories() { return this.api.get<unknown[]>('categories').pipe(map((items) => items.map((item) => this.category(item)))); }
  services(query: ApiQuery = {}) { return this.allPages<unknown>('services', query).pipe(map((items) => items.map((item) => this.serviceModel(item)))); }
  service(idOrSlug: string): Observable<Service> {
    const direct = this.api.get<unknown>(`services/${encodeURIComponent(idOrSlug)}`).pipe(map((item) => this.serviceModel(item)));
    if (this.isUuid(idOrSlug) || environment.useMockApi) return direct;
    return direct.pipe(catchError(() => this.services({ q: idOrSlug }).pipe(
      map((items) => items.find((item) => item.slug === idOrSlug || item.id === idOrSlug) ?? items[0]),
      switchMap((item) => item ? of(item) : this.api.get<unknown>(`services/${encodeURIComponent(idOrSlug)}`).pipe(map((value) => this.serviceModel(value))))
    )));
  }

  providers(query: ApiQuery = {}) {
    const apiQuery: ApiQuery = { service: query['serviceId'] ?? query['service'], city: query['city'], state: query['state'], ratingMin: query['minRating'] ?? query['ratingMin'], sort: query['sort'] };
    const hintedService = String(apiQuery['service'] ?? '');
    return this.allPages<unknown>('professionals', apiQuery).pipe(map((items) => items.map((item) => this.providerModel(item, hintedService ? [hintedService] : []))));
  }
  provider(id: string) { return this.api.get<unknown>(`professionals/${encodeURIComponent(id)}`).pipe(map((item) => this.providerModel(item))); }
  providerReviews(id: string) { return this.allPages<unknown>(`professionals/${encodeURIComponent(id)}/reviews`).pipe(map((items) => items.map((item) => this.reviewModel(item)))); }
  publicProviderAvailability(id: string, query: ApiQuery = {}) { return this.api.get<PublicAvailability>(`professionals/${encodeURIComponent(id)}/availability`, query); }
  bookings(query: ApiQuery = {}) { return this.allPages<unknown>('bookings', query).pipe(map((items) => items.map((item) => this.bookingModel(item)))); }
  booking(id: string) { return this.api.get<unknown>(`bookings/${encodeURIComponent(id)}`).pipe(map((item) => this.bookingModel(item))); }

  quote(draft: BookingDraft): Observable<BookingQuote> {
    return this.api.post<unknown>('bookings/quote', this.quotePayload(draft)).pipe(map((value) => this.quoteModel(value)));
  }

  createBooking(draft: BookingDraft, quote: BookingQuote, idempotencyKey: string): Observable<Booking> {
    if (environment.useMockApi) {
      return this.api.post<unknown>('bookings', { ...draft, quote }, { headers: { 'Idempotency-Key': idempotencyKey } }).pipe(map((item) => this.bookingModel(item)));
    }
    return this.ensureAddress(draft.address).pipe(
      switchMap((address) => this.api.post<unknown>('bookings', {
        ...this.quotePayload(draft), addressId: address.id,
        mode: draft.providerId ? 'direct' : 'marketplace', scheduledStart: `${draft.date}T${draft.time}:00`,
        timezone: 'America/Sao_Paulo', durationMinutes: quote.durationMinutes,
        quantity: quote.quantity, areaSqm: quote.areaSqm ?? draft.homeSize, notes: draft.notes || null
      }, { headers: { 'Idempotency-Key': idempotencyKey } })),
      map((item) => this.bookingModel(item))
    );
  }

  checkoutBooking(draft: BookingDraft, bookingKey: string, paymentKey: string): Observable<CheckoutResult> {
    return this.quote(draft).pipe(
      switchMap((quote) => this.createBooking(draft, quote, bookingKey)),
      switchMap((booking) => this.api.post<PaymentIntent>(`bookings/${booking.id}/payment-intents`, {}, { headers: { 'Idempotency-Key': paymentKey } }).pipe(
        switchMap((payment) => {
          const maySimulate = environment.allowPaymentSimulation && (environment.useMockApi || payment.driver === 'fake');
          if (!maySimulate) return of({ booking, payment, confirmed: booking.status === 'confirmed' });
          return this.api.post<PaymentIntent & { bookingStatus?: string }>(`payments/${payment.id}/simulate`, { scenario: 'success' }).pipe(
            switchMap((paid) => this.booking(booking.id).pipe(
              catchError(() => of({ ...booking, status: paid.bookingStatus === 'confirmed' ? 'confirmed' as const : booking.status })),
              map((fresh) => ({ booking: fresh, payment: { ...payment, ...paid }, confirmed: paid.status === 'paid' }))
            ))
          );
        })
      ))
    );
  }

  cancelBooking(id: string, reason: string) { return this.api.post<unknown>(`bookings/${id}/cancel`, { reason }).pipe(map((item) => this.bookingModel(item))); }
  reviewBooking(id: string, rating: number, comment: string) { return this.api.post<unknown>(`bookings/${id}/reviews`, { rating, comment }).pipe(map((item) => this.reviewModel(item))); }
  bookingOffers(id: string) { return this.api.get<unknown[]>(`bookings/${encodeURIComponent(id)}/offers`).pipe(map((items) => items.map((item) => this.offerModel(item)))); }
  acceptBookingOffer(bookingId: string, offerId: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(bookingId)}/offers/${encodeURIComponent(offerId)}/accept`, {}).pipe(map((item) => this.bookingModel(item))); }
  startBooking(id: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/start`, {}).pipe(map((item) => this.bookingModel(item))); }
  completeBooking(id: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/complete`, {}).pipe(map((item) => this.bookingModel(item))); }
  payBooking(id: string): Observable<Booking> {
    return this.api.post<PaymentIntent>(`bookings/${encodeURIComponent(id)}/payment-intents`, {}, { headers: { 'Idempotency-Key': this.newIdempotencyKey('payment') } }).pipe(
      switchMap((payment) => {
        if (!environment.allowPaymentSimulation || payment.driver !== 'fake') return this.booking(id);
        return this.api.post<PaymentIntent>(`payments/${encodeURIComponent(payment.id)}/simulate`, { scenario: 'success' }).pipe(switchMap(() => this.booking(id)));
      })
    );
  }

  conversations() { return this.api.get<unknown[]>('conversations').pipe(map((items) => items.map((item) => this.conversationModel(item)))); }
  conversationMessages(id: string, query: ApiQuery = {}) { return this.api.get<unknown[]>(`conversations/${id}/messages`, query).pipe(map((items) => items.map((item) => this.chatMessageModel(item)))); }
  sendMessage(id: string, body: string) { return this.api.post<unknown>(`conversations/${id}/messages`, { body }).pipe(map((item) => this.chatMessageModel(item))); }
  markConversationRead(id: string, lastSequence: number) { return this.api.post<void>(`conversations/${id}/read`, { lastSequence }); }

  notifications(query: ApiQuery = {}) { return this.api.getEnvelope<AppNotification[]>('me/notifications', query).pipe(map((response) => ({ ...response, data: response.data.map((item) => ({ ...item, createdAt: this.normalizeDate(item.createdAt), readAt: item.readAt ? this.normalizeDate(item.readAt) : item.readAt })) }))); }
  readNotification(id: string) { return this.api.post<void>(`me/notifications/${encodeURIComponent(id)}/read`, {}); }
  readAllNotifications() { return this.api.post<void>('me/notifications/read-all', {}); }

  metrics(portal: 'customer' | 'provider' | 'admin') {
    if (portal === 'customer') return this.bookings().pipe(map((bookings) => this.customerMetrics(bookings)));
    return this.api.get<unknown>(`${portal}/dashboard`).pipe(map((response) => this.dashboardMetricsFor(portal, response)));
  }

  customerMetrics(bookings: Booking[]): DashboardMetric[] { return [
      { label: 'Agendados', value: String(bookings.filter((item) => !['completed', 'cancelled'].includes(item.status)).length), hint: 'Em acompanhamento', tone: 'brand' },
      { label: 'Concluídos', value: String(bookings.filter((item) => item.status === 'completed').length), hint: 'No seu histórico', tone: 'neutral' },
      { label: 'Total gasto', value: this.money(bookings.filter((item) => ['confirmed', 'provider_on_the_way', 'in_progress', 'completed'].includes(item.status)).reduce((sum, item) => sum + item.price.totalCents, 0)), hint: 'Reservas pagas', tone: 'amber' }
    ]; }

  dashboardMetricsFor(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    return this.dashboardMetrics(portal, value);
  }

  favorite(providerId: string, active = true) { return active ? this.api.post<unknown>(`me/favorites/${providerId}`, {}) : this.api.delete<void>(`me/favorites/${providerId}`); }
  favorites() { return this.api.get<unknown[]>('me/favorites').pipe(map((items) => items.map((item) => this.providerModel(item)))); }
  addresses() { return this.api.get<Address[]>('me/addresses'); }
  createAddress(address: Address) { return this.api.post<Address>('me/addresses', address); }
  updateAddress(id: string, address: Address) { return this.api.put<Address>(`me/addresses/${encodeURIComponent(id)}`, address); }
  removeAddress(id: string) { return this.api.delete<void>(`me/addresses/${encodeURIComponent(id)}`); }

  providerDashboard() { return this.api.get<ProviderDashboard>('provider/dashboard'); }
  providerProfile() { return this.api.get<Record<string, unknown>>('provider/profile'); }
  updateProviderProfile(payload: Record<string, unknown>) { return this.api.patch<Record<string, unknown>>('provider/profile', payload); }
  providerServices() { return this.api.get<ProviderService[]>('provider/services').pipe(map((items) => items.map((item) => ({ ...item, catalogPriceCents: this.number(item.catalogPriceCents), customPriceCents: this.number(item.customPriceCents, this.number(item.catalogPriceCents)) })))); }
  updateProviderService(id: string, payload: { priceCents: number; active: boolean }) { return this.api.put<ProviderService>(`provider/services/${id}`, payload); }
  removeProviderService(id: string) { return this.api.delete<void>(`provider/services/${id}`); }
  providerAvailability() { return this.api.get<AvailabilityRule[]>('provider/availability'); }
  saveProviderAvailability(rules: AvailabilityRule[]) { return this.api.put<AvailabilityRule[]>('provider/availability', { rules: rules.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })) }); }
  providerAvailabilityExceptions() { return this.api.get<AvailabilityException[]>('provider/availability-exceptions'); }
  createProviderAvailabilityException(payload: Omit<AvailabilityException, 'id'>) { return this.api.post<AvailabilityException>('provider/availability-exceptions', payload); }
  removeProviderAvailabilityException(id: string) { return this.api.delete<void>(`provider/availability-exceptions/${encodeURIComponent(id)}`); }
  providerJobs() { return this.api.get<ProviderJob[]>('provider/jobs').pipe(map((items) => items.map((item) => ({ ...item, scheduledStart: this.normalizeDate(item.scheduledStart), scheduledEnd: item.scheduledEnd ? this.normalizeDate(item.scheduledEnd) : undefined })))); }
  providerOpenRequests() { return this.api.get<ProviderRequest[]>('provider/open-requests').pipe(map((items) => items.map((item) => ({ ...item, scheduledStart: this.normalizeDate(item.scheduledStart), createdAt: this.normalizeDate(item.createdAt) })))); }
  createOffer(bookingId: string, amountCents: number, message: string) { return this.api.post<unknown>(`provider/bookings/${bookingId}/offers`, { amountCents, message }); }

  adminDashboard() { return this.api.get<Record<string, unknown>>('admin/dashboard'); }
  adminUsers(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/users', query); }
  adminPendingProviders(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/professionals/pending', query); }
  adminBookings(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/bookings', query); }
  adminPayments(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/payments', query); }
  adminCoupons(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/coupons', query); }
  adminCreateService(payload: Record<string, unknown>) { return this.api.post<unknown>('admin/services', payload); }
  adminCreateCoupon(payload: Record<string, unknown>) { return this.api.post<unknown>('admin/coupons', payload); }
  adminReviewProvider(id: string, status: 'approved' | 'rejected' | 'suspended', notes = '') { return this.api.post<unknown>(`admin/professionals/${id}/review`, { status, notes }); }
  adminUserStatus(id: string, status: 'active' | 'suspended', reason = '') { return this.api.patch<unknown>(`admin/users/${id}/status`, { status, reason }); }

  newIdempotencyKey(prefix: string): string {
    const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${value}`;
  }

  private category(value: unknown): ServiceCategory {
    const item = this.record(value); const name = this.string(item['name'], 'Serviço');
    return { id: this.string(item['id']), slug: this.string(item['slug']), name, shortName: this.string(item['shortName'], name), description: this.string(item['description']), symbol: this.string(item['symbol'] ?? item['icon'], this.initials(name)), serviceCount: this.number(item['serviceCount'] ?? item['servicesCount']) };
  }

  private serviceModel(value: unknown): Service {
    const item = this.record(value); const name = this.string(item['name'], 'Serviço');
    const pricingType = this.string(item['pricingType'], 'fixed') as Service['pricingType'];
    const unitLabel = this.string(item['unit'] ?? item['unitLabel'], pricingType === 'area' ? 'm²' : 'serviço').toLocaleLowerCase('pt-BR');
    const unit: Service['unit'] = pricingType === 'area' || unitLabel.includes('m²') ? 'm²' : unitLabel.includes('hora') ? 'hora' : unitLabel.includes('diária') ? 'diária' : 'serviço';
    const rawAddons = Array.isArray(item['addons']) ? item['addons'] : [];
    return { id: this.string(item['id']), categoryId: this.string(item['categoryId']), slug: this.string(item['slug']), name, description: this.string(item['description'] ?? item['shortDescription']), symbol: this.string(item['symbol'], this.initials(name)), priceFromCents: this.number(item['priceFromCents'] ?? item['priceCents']), unit, pricingType, durationMinutes: this.number(item['durationMinutes'] ?? item['defaultDurationMinutes'], 120), minimumQuantity: this.number(item['minimumQuantity'], 1), maximumQuantity: this.number(item['maximumQuantity'], 10000), addons: rawAddons.map((raw) => { const addon = this.record(raw); return { id: this.string(addon['id']), name: this.string(addon['name']), description: this.string(addon['description']), priceCents: this.number(addon['priceCents']), pricingType: this.string(addon['pricingType'], 'fixed') as 'fixed' | 'hourly' | 'quantity' }; }), popular: Boolean(item['popular']) };
  }

  private providerModel(value: unknown, hintedServices: string[] = []): ProviderProfile {
    const item = this.record(value); const name = this.string(item['name'], 'Profissional');
    const rawServices = Array.isArray(item['services']) ? item['services'] : [];
    const serviceIds = Array.isArray(item['serviceIds']) ? item['serviceIds'].map(String) : typeof item['serviceIds'] === 'string' ? item['serviceIds'].split(',').filter(Boolean) : rawServices.map((service) => this.string(this.record(service)['id'])).filter(Boolean);
    const servicePrices = rawServices.map((service) => this.number(this.record(service)['priceCents'])).filter((price) => price > 0);
    const rawReviews = Array.isArray(item['reviews']) ? item['reviews'] : [];
    return {
      id: this.string(item['id']), name, initials: this.string(item['initials'], this.initials(name)), headline: this.string(item['headline'], 'Profissional de serviços domésticos'),
      bio: this.string(item['bio'], 'Perfil profissional aprovado na plataforma ChezVoust Pro.'), city: this.string(item['city'] ?? item['baseCity'], 'Cidade não informada'), neighborhood: this.string(item['neighborhood'] ?? item['state'] ?? item['baseState']),
      verified: Boolean(item['verified']) || this.string(item['verificationStatus']) === 'approved', verificationStatus: (this.string(item['verificationStatus'], 'pending') as ProviderProfile['verificationStatus']), topProvider: Boolean(item['topProvider'] ?? item['featured']), rating: this.number(item['rating'], 0),
      reviewCount: this.number(item['reviewCount'] ?? item['reviewsCount']), completedJobs: this.number(item['completedJobs']), responseTime: this.string(item['responseTime'], 'Responde pela plataforma'),
      priceFromCents: this.number(item['priceFromCents'], servicePrices.length ? Math.min(...servicePrices) : 0), serviceIds: [...new Set([...serviceIds, ...hintedServices])],
      qualities: Array.isArray(item['qualities']) ? item['qualities'].map(String) : ['Perfil aprovado', 'Atendimento pela plataforma'], nextAvailability: this.string(item['nextAvailability'], 'Consulte a agenda'),
      reviews: rawReviews.map((review) => this.reviewModel(review))
    };
  }

  private reviewModel(value: unknown): Review {
    const item = this.record(value); const author = this.string(item['author'] ?? item['customerName'], 'Cliente');
    return { id: this.string(item['id']), author, initials: this.string(item['initials'], this.initials(author)), rating: this.number(item['rating'], 5), comment: this.string(item['comment']), createdAt: this.string(item['createdAt'], new Date().toISOString()) };
  }

  private bookingModel(value: unknown): Booking {
    const item = this.record(value); if (item['service'] && item['provider'] && item['price']) { const booking = value as Booking; return { ...booking, canMessage: Boolean(booking.canMessage ?? booking.conversationId), allowedActions: booking.allowedActions ?? [booking.canCancel ? 'cancel' : '', booking.canReview ? 'review' : '', booking.canMessage ? 'message' : ''].filter(Boolean) }; }
    const status = this.bookingStatus(this.string(item['status'])); const serviceName = this.string(item['serviceName'], 'Serviço doméstico');
    const professionalName = this.string(item['professionalName'], 'Profissional a definir'); const pricing = this.record(item['pricingSnapshot']);
    const totalCents = this.number(item['totalCents'] ?? pricing['totalCents']); const address = this.record(item['addressSnapshot']);
    const actions = Array.isArray(item['allowedActions']) ? item['allowedActions'].map(String) : [];
    return {
      id: this.string(item['id']), code: this.string(item['code'], `CVP-${this.string(item['id']).slice(0, 8).toUpperCase()}`),
      service: { id: this.string(item['serviceId']), categoryId: '', slug: '', name: serviceName, description: '', symbol: this.initials(serviceName), priceFromCents: totalCents, unit: 'serviço', durationMinutes: this.number(item['durationMinutes'], 120) },
      provider: { id: this.string(item['professionalId']), name: professionalName, initials: this.initials(professionalName), headline: '', bio: '', city: '', neighborhood: '', verified: true, rating: 5, reviewCount: 0, completedJobs: 0, responseTime: '', priceFromCents: 0, serviceIds: [], qualities: [], nextAvailability: '', reviews: [] },
      customerName: this.string(item['customerName'], 'Cliente'), status, scheduledAt: this.normalizeDate(this.string(item['scheduledAt'] ?? item['scheduledStart'])),
      addressLabel: [this.string(address['neighborhood']), this.string(address['city'])].filter(Boolean).join(', ') || 'Endereço da reserva', notes: this.string(item['notes']),
      price: { subtotalCents: this.number(item['subtotalCents'] ?? pricing['subtotalCents'], totalCents), serviceFeeCents: this.number(item['serviceFeeCents'] ?? pricing['serviceFeeCents']), discountCents: this.number(item['discountCents'] ?? pricing['discountCents']), totalCents, currency: 'BRL' },
      canCancel: actions.length ? actions.includes('cancel') : ['open', 'awaiting_payment', 'confirmed'].includes(status),
      canReview: actions.length ? actions.includes('review') : Boolean(item['canReview']), canMessage: actions.length ? actions.includes('message') : Boolean(item['conversationId']), conversationId: this.string(item['conversationId']) || undefined, allowedActions: actions
    };
  }

  private bookingStatus(value: string): BookingStatus {
    const statuses: Record<string, BookingStatus> = { open: 'open', awaiting_payment: 'awaiting_payment', awaiting_confirmation: 'awaiting_confirmation', paid: 'confirmed', confirmed: 'confirmed', provider_on_the_way: 'provider_on_the_way', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled', disputed: 'disputed', refunded: 'refunded' };
    return statuses[value] ?? 'awaiting_confirmation';
  }

  private dashboardMetrics(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    if (Array.isArray(value)) return value as DashboardMetric[];
    const data = this.record(value); const metrics = this.record(data['metrics']);
    if (portal === 'provider') { const profile = this.record(data['profile']); return [
      { label: 'Ganhos acumulados', value: this.money(this.number(metrics['earningsCents'])), hint: 'Serviços concluídos', tone: 'brand' },
      { label: 'Novas solicitações', value: String(this.number(metrics['openRequests'])), hint: 'Oportunidades disponíveis', tone: 'coral' },
      { label: 'Próximos serviços', value: String(this.number(metrics['upcomingJobs'])), hint: 'Confirmados na agenda', tone: 'neutral' },
      { label: 'Sua avaliação', value: this.number(profile['rating'], 5).toFixed(2).replace('.', ','), hint: `${this.number(profile['reviewsCount'])} avaliações`, tone: 'amber' }
    ]; }
    return [
      { label: 'Reservas', value: String(this.number(metrics['bookings'])), hint: `${this.number(metrics['confirmedBookings'])} confirmadas`, tone: 'brand' },
      { label: 'Volume bruto', value: this.money(this.number(metrics['grossVolumeCents'])), hint: `${this.number(metrics['paidPayments'])} pagamentos`, tone: 'amber' },
      { label: 'Prestadores em análise', value: String(this.number(metrics['professionalsPending'])), hint: `${this.number(metrics['professionals'])} cadastrados`, tone: 'coral' },
      { label: 'Clientes', value: String(this.number(metrics['customers'])), hint: 'Contas na plataforma', tone: 'neutral' }
    ];
  }

  private quotePayload(draft: BookingDraft): Record<string, unknown> {
    return {
      serviceId: draft.serviceId,
      professionalId: draft.providerId || null,
      quantity: Math.max(1, Number(draft.quantity) || 1),
      durationMinutes: Math.max(30, Number(draft.durationMinutes) || 120),
      areaSqm: Math.max(1, Number(draft.homeSize) || 1),
      addonIds: draft.addonIds,
      couponCode: draft.coupon?.trim() || null
    };
  }

  private quoteModel(value: unknown): BookingQuote {
    const item = this.record(value);
    const pricingType = this.string(item['pricingType'], 'fixed') as BookingQuote['pricingType'];
    const rawItems = Array.isArray(item['items']) ? item['items'] : [];
    return {
      serviceId: this.string(item['serviceId']), serviceName: this.string(item['serviceName'], 'Serviço doméstico'), pricingType,
      durationMinutes: this.number(item['durationMinutes'], 120), quantity: this.number(item['quantity'], 1),
      areaSqm: item['areaSqm'] == null ? undefined : this.number(item['areaSqm']),
      items: rawItems.map((raw) => { const row = this.record(raw); return { type: this.string(row['type']), name: this.string(row['name']), quantity: this.number(row['quantity'], 1), unitPriceCents: this.number(row['unitPriceCents']), totalCents: this.number(row['totalCents']) }; }),
      subtotalCents: this.number(item['subtotalCents']), serviceFeeCents: this.number(item['serviceFeeCents']), discountCents: this.number(item['discountCents']), totalCents: this.number(item['totalCents']),
      professionalAmountCents: this.number(item['professionalAmountCents']), currency: 'BRL', couponCode: this.string(item['couponCode']) || null
    };
  }

  private ensureAddress(address: Address): Observable<Address> {
    const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
    return this.api.get<Address[]>('me/addresses').pipe(
      map((items) => items.find((item) => normalize(item.postalCode) === normalize(address.postalCode) && normalize(item.street) === normalize(address.street) && normalize(item.number) === normalize(address.number))),
      switchMap((existing) => existing ? of(existing) : this.api.post<Address>('me/addresses', { ...address, label: address.label || 'Casa', isDefault: false }))
    );
  }

  private conversationModel(value: unknown): Conversation {
    const item = this.record(value);
    return { id: this.string(item['id']), bookingId: this.string(item['bookingId']), bookingStatus: this.string(item['bookingStatus']), serviceName: this.string(item['serviceName'], 'Serviço'), updatedAt: this.normalizeDate(this.string(item['updatedAt'])), lastMessage: this.string(item['lastMessage'], 'Conversa iniciada.'), unreadCount: this.number(item['unreadCount']) };
  }

  private chatMessageModel(value: unknown): ChatMessage {
    const item = this.record(value);
    return { id: this.string(item['id']), sequence: this.number(item['sequence']), senderId: this.string(item['senderId']), senderName: this.string(item['senderName'], 'Usuário'), body: this.string(item['body']), messageType: this.string(item['messageType'], 'text'), createdAt: this.normalizeDate(this.string(item['createdAt'])) };
  }

  private offerModel(value: unknown): BookingOffer {
    const item = this.record(value);
    return { id: this.string(item['id']), amountCents: this.number(item['amountCents']), message: this.string(item['message']), status: this.string(item['status'], 'pending'), expiresAt: this.normalizeDate(this.string(item['expiresAt'])), createdAt: this.normalizeDate(this.string(item['createdAt'])), professionalId: this.string(item['professionalId']), professionalName: this.string(item['professionalName'], 'Profissional'), rating: this.number(item['rating']), reviewsCount: this.number(item['reviewsCount']) };
  }

  private normalizeDate(value: string): string {
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  }

  private allPages<T>(path: string, query: ApiQuery = {}): Observable<T[]> {
    const firstPage = Math.max(1, Number(query['page']) || 1);
    const perPage = Math.max(1, Math.min(50, Number(query['perPage']) || 50));
    return this.api.getEnvelope<T[]>(path, { ...query, page: firstPage, perPage }).pipe(
      expand((response) => {
        const page = Math.max(firstPage, Number(response.meta?.['page']) || firstPage);
        const lastPage = Math.max(page, Number(response.meta?.['lastPage']) || page);
        return page < lastPage ? this.api.getEnvelope<T[]>(path, { ...query, page: page + 1, perPage }) : EMPTY;
      }),
      reduce((items, response) => [...items, ...(Array.isArray(response.data) ? response.data : [])], [] as T[])
    );
  }

  private isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

  private record(value: unknown): UnknownRecord { return value !== null && typeof value === 'object' ? value as UnknownRecord : {}; }
  private string(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value : fallback; }
  private number(value: unknown, fallback = 0): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  private initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''); }
  private money(cents: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cents / 100); }
}
