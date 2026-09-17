import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, of, reduce, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiQuery, ApiService } from '../http/api.service';
import { AppCurrency, LocalizationService } from '../localization/localization.service';
import {
  Address, AppNotification, AvailabilityException, AvailabilityRule, Booking, BookingDraft, BookingOffer, BookingQuote, BookingStatus, ChatMessage,
  BookingConfirmation, Conversation, DashboardMetric, ProviderDashboard, ProviderJob,
  ProfessionalComment, ProfessionalCourse, ProfessionalExperience, ProviderProfile, ProviderRequest, ProviderService, PublicAvailability, Review, Service, ServiceCategory
} from '../models';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly api = inject(ApiService);
  private readonly localization = inject(LocalizationService);

  categories() { return this.api.get<unknown[]>('categories').pipe(map((items) => items.map((item) => this.category(item)))); }
  services(query: ApiQuery = {}) { return this.allPages<unknown>('services', query).pipe(map((items) => items.map((item) => this.serviceModel(item)))); }
  servicesPage(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('services', query).pipe(map((response) => ({ ...response, data: (response.data ?? []).map((item) => this.serviceModel(item)) }))); }
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
  providersPage(query: ApiQuery = {}) {
    const apiQuery: ApiQuery = { service: query['serviceId'] ?? query['service'], city: query['city'], state: query['state'], ratingMin: query['minRating'] ?? query['ratingMin'], sort: query['sort'], page: query['page'], perPage: query['perPage'] };
    const hintedService = String(apiQuery['service'] ?? '');
    return this.api.getEnvelope<unknown[]>('professionals', apiQuery).pipe(map((response) => ({ ...response, data: (response.data ?? []).map((item) => this.providerModel(item, hintedService ? [hintedService] : [])) })));
  }
  provider(id: string) { return this.api.get<unknown>(`professionals/${encodeURIComponent(id)}`).pipe(map((item) => this.providerModel(item))); }
  providerReviewsPage(id: string, page = 1) { return this.api.getEnvelope<unknown[]>(`professionals/${encodeURIComponent(id)}/reviews`, { page, perPage: 20 }).pipe(map((response) => ({ ...response, data: (response.data ?? []).map((item) => this.reviewModel(item)) }))); }
  providerReviews(id: string, page = 1) { return this.providerReviewsPage(id, page).pipe(map((response) => response.data)); }
  providerCommentsPage(id: string, page = 1) { return this.api.getEnvelope<unknown[]>(`professionals/${encodeURIComponent(id)}/comments`, { page, perPage: 20 }).pipe(map((response) => ({ ...response, data: (response.data ?? []).map((item) => this.commentModel(item)) }))); }
  providerComments(id: string, page = 1) { return this.providerCommentsPage(id, page).pipe(map((response) => response.data)); }
  createProviderComment(id: string, comment: string) { return this.api.post<unknown>(`professionals/${encodeURIComponent(id)}/comments`, { comment }).pipe(map((item) => this.commentModel(item))); }
  startProfessionalConversation(id: string) { return this.api.post<{ conversationId: string }>(`professionals/${encodeURIComponent(id)}/conversation`, {}); }
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

  confirmBooking(draft: BookingDraft, bookingKey: string): Observable<BookingConfirmation> {
    return this.quote(draft).pipe(
      switchMap((quote) => this.createBooking(draft, quote, bookingKey)),
      map((booking) => ({ booking, confirmed: booking.status === 'confirmed' }))
    );
  }

  cancelBooking(id: string, reason: string) { return this.api.post<unknown>(`bookings/${id}/cancel`, { reason }).pipe(map((item) => this.bookingModel(item))); }
  reviewBooking(id: string, rating: number, comment: string) { return this.api.post<unknown>(`bookings/${id}/reviews`, { rating, comment }).pipe(map((item) => this.reviewModel(item))); }
  bookingOffers(id: string) { return this.api.get<unknown[]>(`bookings/${encodeURIComponent(id)}/offers`).pipe(map((items) => items.map((item) => this.offerModel(item)))); }
  acceptBookingOffer(bookingId: string, offerId: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(bookingId)}/offers/${encodeURIComponent(offerId)}/accept`, {}).pipe(map((item) => this.bookingModel(item))); }
  startBooking(id: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/start`, {}).pipe(map((item) => this.bookingModel(item))); }
  markBookingOnTheWay(id: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/on-the-way`, {}).pipe(map((item) => this.bookingModel(item))); }
  completeBooking(id: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/complete`, {}).pipe(map((item) => this.bookingModel(item))); }
  rescheduleBooking(id: string, date: string, time: string) { return this.api.post<unknown>(`bookings/${encodeURIComponent(id)}/reschedule`, { scheduledStart: `${date}T${time}:00`, timezone: 'America/Sao_Paulo' }).pipe(map((item) => this.bookingModel(item))); }
  conversationsPage(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('conversations', { page: query['page'], perPage: query['perPage'] ?? 30 }).pipe(map((response) => ({ ...response, data: (response.data ?? []).map((item) => this.conversationModel(item)) }))); }
  conversations() { return this.conversationsPage().pipe(map((response) => response.data)); }
  conversationMessages(id: string, query: ApiQuery = {}) { return this.api.get<unknown[]>(`conversations/${id}/messages`, query).pipe(map((items) => items.map((item) => this.chatMessageModel(item)))); }
  conversationMessageUpdates(id: string, after: number) { return this.api.get<unknown[]>(`conversations/${encodeURIComponent(id)}/events`, { after, limit: 50 }).pipe(map((items) => items.map((item) => this.chatMessageModel(item)))); }
  sendMessage(id: string, body: string, idempotencyKey: string) { return this.api.post<unknown>(`conversations/${encodeURIComponent(id)}/messages`, { body }, { headers: { 'Idempotency-Key': idempotencyKey } }).pipe(map((item) => this.chatMessageModel(item))); }
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
      { label: 'Valores de referência', value: this.money(bookings.filter((item) => ['confirmed', 'provider_on_the_way', 'in_progress', 'completed'].includes(item.status)).reduce((sum, item) => sum + this.localization.convertAmount(item.price.totalCents, item.price.currency, 'BRL'), 0)), hint: 'Reservas confirmadas', tone: 'amber' }
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
  providerExperiences() { return this.api.get<unknown[]>('provider/profile/experiences').pipe(map((items) => items.map((item) => this.experienceModel(item)))); }
  createProviderExperience(payload: Omit<ProfessionalExperience, 'id'>) { return this.api.post<unknown>('provider/profile/experiences', payload).pipe(map((item) => this.experienceModel(item))); }
  updateProviderExperience(id: string, payload: Omit<ProfessionalExperience, 'id'>) { return this.api.put<unknown>(`provider/profile/experiences/${encodeURIComponent(id)}`, payload).pipe(map((item) => this.experienceModel(item))); }
  removeProviderExperience(id: string) { return this.api.delete<void>(`provider/profile/experiences/${encodeURIComponent(id)}`); }
  providerCourses() { return this.api.get<unknown[]>('provider/profile/courses').pipe(map((items) => items.map((item) => this.courseModel(item)))); }
  createProviderCourse(payload: Omit<ProfessionalCourse, 'id'>) { return this.api.post<unknown>('provider/profile/courses', payload).pipe(map((item) => this.courseModel(item))); }
  updateProviderCourse(id: string, payload: Omit<ProfessionalCourse, 'id'>) { return this.api.put<unknown>(`provider/profile/courses/${encodeURIComponent(id)}`, payload).pipe(map((item) => this.courseModel(item))); }
  removeProviderCourse(id: string) { return this.api.delete<void>(`provider/profile/courses/${encodeURIComponent(id)}`); }
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
  adminContentReports(query: ApiQuery = {}) { return this.api.getEnvelope<unknown[]>('admin/content-reports', query); }
  adminResolveContentReport(id: string, action: 'hide' | 'retain', note: string) { return this.api.post<unknown>(`admin/content-reports/${encodeURIComponent(id)}/resolve`, { action, note }); }
  reportContent(contentType: 'professional_comment' | 'review' | 'message', contentId: string, reason: string) { return this.api.post<unknown>('content-reports', { contentType, contentId, reason }); }
  adminCreateService(payload: Record<string, unknown>) { return this.api.post<unknown>('admin/services', payload); }
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
      id: this.string(item['id']), name, initials: this.string(item['initials'], this.initials(name)), headline: this.string(item['headline'], 'Home services professional'),
      bio: this.string(item['bio'], 'Platform-approved professional profile.'), city: this.string(item['city'] ?? item['baseCity'], 'City not specified'), neighborhood: this.string(item['neighborhood'] ?? item['state'] ?? item['baseState']),
      verified: Boolean(item['verified']) || this.string(item['verificationStatus']) === 'approved', verificationStatus: (this.string(item['verificationStatus'], 'pending') as ProviderProfile['verificationStatus']), topProvider: Boolean(item['topProvider'] ?? item['featured']), rating: this.number(item['rating'], 0),
      reviewCount: this.number(item['reviewCount'] ?? item['reviewsCount']), completedJobs: this.number(item['completedJobs']), responseTime: this.string(item['responseTime'], 'Replies through the platform'),
      priceFromCents: this.number(item['priceFromCents'], servicePrices.length ? Math.min(...servicePrices) : 0), serviceIds: [...new Set([...serviceIds, ...hintedServices])],
      qualities: Array.isArray(item['qualities']) ? item['qualities'].map(String) : ['Approved profile', 'In-platform support'], nextAvailability: this.string(item['nextAvailability'], 'Check the schedule'),
      reviews: rawReviews.map((review) => this.reviewModel(review)), avatarUrl: this.string(item['avatarUrl']) || null,
      state: this.string(item['state'] ?? item['baseState']) || undefined, yearsExperience: this.number(item['yearsExperience']), memberSince: this.string(item['memberSince']) || undefined,
      experiences: Array.isArray(item['experiences']) ? item['experiences'].map((experience) => this.experienceModel(experience)) : [],
      courses: Array.isArray(item['courses']) ? item['courses'].map((course) => this.courseModel(course)) : []
    };
  }

  private reviewModel(value: unknown): Review {
    const item = this.record(value); const author = this.string(item['author'] ?? item['customerName'], 'Cliente');
    return { id: this.string(item['id']), author, initials: this.string(item['initials'], this.initials(author)), rating: this.number(item['rating'], 5), comment: this.string(item['comment']), createdAt: this.string(item['createdAt'], new Date().toISOString()), serviceName: this.string(item['serviceName']) || undefined, providerReply: this.string(item['providerReply']) || undefined, verifiedTransaction: true };
  }

  private commentModel(value: unknown): ProfessionalComment {
    const item = this.record(value); const author = this.string(item['author'], 'Membro da comunidade');
    return { id: this.string(item['id']), author, initials: this.string(item['initials'], this.initials(author)), comment: this.string(item['comment']), createdAt: this.normalizeDate(this.string(item['createdAt'])) };
  }

  private experienceModel(value: unknown): ProfessionalExperience {
    const item = this.record(value);
    return { id: this.string(item['id']), role: this.string(item['role']), company: this.string(item['company']), description: this.string(item['description']) || null, startedAt: this.string(item['startedAt']), endedAt: this.string(item['endedAt']) || null, current: this.number(item['current']) === 1 };
  }

  private courseModel(value: unknown): ProfessionalCourse {
    const item = this.record(value);
    return { id: this.string(item['id']), title: this.string(item['title']), institution: this.string(item['institution']), completedAt: this.string(item['completedAt']) || null, certificateUrl: this.string(item['certificateUrl']) || null };
  }

  private bookingModel(value: unknown): Booking {
    const item = this.record(value); if (item['service'] && item['provider'] && item['price']) { const booking = value as Booking; return { ...booking, price: { ...booking.price, currency: this.currency(booking.price.currency) }, history: booking.history ?? [], canMessage: Boolean(booking.canMessage ?? booking.conversationId), allowedActions: booking.allowedActions ?? [booking.canCancel ? 'cancel' : '', booking.canReview ? 'review' : '', booking.canMessage ? 'message' : ''].filter(Boolean) }; }
    const status = this.bookingStatus(this.string(item['status'])); const serviceName = this.string(item['serviceName'], 'Serviço doméstico');
    const professionalName = this.string(item['professionalName'], 'Profissional a definir'); const pricing = this.record(item['pricingSnapshot']);
    const totalCents = this.number(item['totalCents'] ?? pricing['totalCents']); const address = this.record(item['addressSnapshot']);
    const actions = Array.isArray(item['allowedActions']) ? item['allowedActions'].map(String) : [];
    const history = Array.isArray(item['history']) ? item['history'].map((entry) => { const row = this.record(entry); return { fromStatus: this.string(row['fromStatus']) || null, toStatus: this.bookingStatus(this.string(row['toStatus'])), reason: this.string(row['reason']), createdAt: this.normalizeDate(this.string(row['createdAt'])) }; }) : [];
    return {
      id: this.string(item['id']), code: this.string(item['code'], `CVP-${this.string(item['id']).slice(0, 8).toUpperCase()}`),
      service: { id: this.string(item['serviceId']), categoryId: '', slug: '', name: serviceName, description: '', symbol: this.initials(serviceName), priceFromCents: totalCents, unit: 'serviço', durationMinutes: this.number(item['durationMinutes'], 120) },
      provider: { id: this.string(item['professionalId']), name: professionalName, initials: this.initials(professionalName), headline: '', bio: '', city: '', neighborhood: '', verified: true, rating: 5, reviewCount: 0, completedJobs: 0, responseTime: '', priceFromCents: 0, serviceIds: [], qualities: [], nextAvailability: '', reviews: [] },
      customerName: this.string(item['customerName'], 'Cliente'), status, scheduledAt: this.normalizeDate(this.string(item['scheduledAt'] ?? item['scheduledStart'])),
      addressLabel: [this.string(address['neighborhood']), this.string(address['city'])].filter(Boolean).join(', ') || 'Endereço da reserva', notes: this.string(item['notes']),
      price: { subtotalCents: this.number(item['subtotalCents'] ?? pricing['subtotalCents'], totalCents), serviceFeeCents: this.number(item['serviceFeeCents'] ?? pricing['serviceFeeCents']), discountCents: this.number(item['discountCents'] ?? pricing['discountCents']), totalCents, currency: this.currency(item['currency'] ?? pricing['currency']) },
      canCancel: actions.length ? actions.includes('cancel') : ['open', 'confirmed'].includes(status),
      canReview: actions.length ? actions.includes('review') : Boolean(item['canReview']), canMessage: actions.length ? actions.includes('message') : Boolean(item['conversationId']), conversationId: this.string(item['conversationId']) || undefined, allowedActions: actions, history
    };
  }

  private bookingStatus(value: string): BookingStatus {
    const statuses: Record<string, BookingStatus> = { open: 'open', awaiting_confirmation: 'awaiting_confirmation', confirmed: 'confirmed', provider_on_the_way: 'provider_on_the_way', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled', disputed: 'disputed' };
    return statuses[value] ?? 'awaiting_confirmation';
  }

  private dashboardMetrics(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    if (Array.isArray(value)) return value as DashboardMetric[];
    const data = this.record(value); const metrics = this.record(data['metrics']);
    if (portal === 'provider') { const profile = this.record(data['profile']); return [
      { label: 'Serviços concluídos', value: String(this.number(metrics['completedJobs'])), hint: 'Atendimentos finalizados', tone: 'brand' },
      { label: 'Novas solicitações', value: String(this.number(metrics['openRequests'])), hint: 'Oportunidades disponíveis', tone: 'coral' },
      { label: 'Próximos serviços', value: String(this.number(metrics['upcomingJobs'])), hint: 'Confirmados na agenda', tone: 'neutral' },
      { label: 'Sua avaliação', value: this.number(profile['rating'], 5).toFixed(2).replace('.', ','), hint: `${this.number(profile['reviewsCount'])} avaliações`, tone: 'amber' }
    ]; }
    return [
      { label: 'Reservas', value: String(this.number(metrics['bookings'])), hint: `${this.number(metrics['confirmedBookings'])} confirmadas`, tone: 'brand' },
      { label: 'Concluídas', value: String(this.number(metrics['completedBookings'])), hint: 'Atendimentos finalizados', tone: 'amber' },
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
      currency: draft.currency
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
      currency: this.currency(item['currency'])
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
    return { id: this.string(item['id']), bookingId: this.string(item['bookingId']), bookingStatus: this.string(item['bookingStatus']), serviceName: this.string(item['serviceName'], 'Serviço'), contactName: this.string(item['contactName']) || undefined, contactId: this.string(item['contactId']) || undefined, contactAvatarUrl: this.string(item['contactAvatarUrl']) || null, updatedAt: this.normalizeDate(this.string(item['updatedAt'])), lastMessage: this.string(item['lastMessage'], 'Conversa iniciada.'), unreadCount: this.number(item['unreadCount']) };
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
      reduce((items, response) => {
        items.push(...(Array.isArray(response.data) ? response.data : []));
        return items;
      }, [] as T[])
    );
  }

  private isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

  private record(value: unknown): UnknownRecord { return value !== null && typeof value === 'object' ? value as UnknownRecord : {}; }
  private string(value: unknown, fallback = ''): string { return typeof value === 'string' && value.trim() ? value : fallback; }
  private number(value: unknown, fallback = 0): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  private initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''); }
  private money(cents: number): string { return this.localization.formatMoney(cents / 100, 'BRL', 0); }
  private currency(value: unknown): AppCurrency {
    const currency = String(value).toUpperCase();
    return currency === 'USD' || currency === 'EUR' || currency === 'BRL' ? currency : 'BRL';
  }
}
