import { MarketplaceMapper } from './marketplace-mapper';
import { apiBoolean } from '../http/api-value.util';
import { Injectable, inject } from '@angular/core';
import {
  EMPTY,
  Observable,
  catchError,
  expand,
  map,
  of,
  reduce,
  shareReplay,
  switchMap
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiQuery, ApiService } from '../http/api.service';
import { AppCurrency, LocalizationService } from '../localization/localization.service';
import { normalizeProviderServicePrices } from '../../shared/utils/provider-service.util';
import { PostalCodeAddress, postalCodeDigits } from '../../shared/utils/postal-code.util';
import {
  Address,
  AppNotification,
  AvailabilityException,
  AvailabilityRule,
  Booking,
  BookingDraft,
  BookingOffer,
  BookingQuote,
  BookingStatus,
  ChatMessage,
  BookingConfirmation,
  Conversation,
  DashboardMetric,
  ProviderDashboard,
  ProviderJob,
  HomeContent,
  Product,
  ProfessionalComment,
  ProfessionalCourse,
  ProfessionalExperience,
  Promotion,
  ProviderProfile,
  ProviderRequest,
  ProviderService,
  PublicAvailability,
  Review,
  Service,
  ServiceCategory
} from '../models';

type UnknownRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly api = inject(ApiService);
  private readonly localization = inject(LocalizationService);
  private readonly mapper = new MarketplaceMapper(this.localization);
  private readonly categoriesRequest$ = this.api.get<unknown[]>('categories').pipe(
    map((items) => items.map((item) => this.category(item))),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  categories() {
    return this.categoriesRequest$;
  }
  home(): Observable<HomeContent> {
    return this.api.get<unknown>('home').pipe(
      map((value) => {
        const item = this.record(value);
        const promotions = Array.isArray(item['promotions'])
          ? item['promotions'].map((promotion) => this.promotionModel(promotion))
          : [];
        return { promotions };
      })
    );
  }
  productsPage(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('products', query).pipe(
      map((response) => ({
        ...response,
        data: (response.data ?? []).map((item) => this.productModel(item))
      }))
    );
  }
  products(query: ApiQuery = {}) {
    return this.allPages<unknown>('products', query).pipe(
      map((items) => items.map((item) => this.productModel(item)))
    );
  }
  services(query: ApiQuery = {}) {
    return this.allPages<unknown>('services', query).pipe(
      map((items) => items.map((item) => this.serviceModel(item)))
    );
  }
  servicesPage(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('services', query).pipe(
      map((response) => ({
        ...response,
        data: (response.data ?? []).map((item) => this.serviceModel(item))
      }))
    );
  }
  service(idOrSlug: string): Observable<Service> {
    const direct = this.api
      .get<unknown>(`services/${encodeURIComponent(idOrSlug)}`)
      .pipe(map((item) => this.serviceModel(item)));
    if (this.isUuid(idOrSlug) || environment.useMockApi) return direct;
    return direct.pipe(
      catchError(() =>
        this.services({ q: idOrSlug }).pipe(
          map(
            (items) =>
              items.find((item) => item.slug === idOrSlug || item.id === idOrSlug) ?? items[0]
          ),
          switchMap((item) =>
            item
              ? of(item)
              : this.api
                  .get<unknown>(`services/${encodeURIComponent(idOrSlug)}`)
                  .pipe(map((value) => this.serviceModel(value)))
          )
        )
      )
    );
  }

  providers(query: ApiQuery = {}) {
    const apiQuery: ApiQuery = {
      service: query['serviceId'] ?? query['service'],
      city: query['city'],
      state: query['state'],
      ratingMin: query['minRating'] ?? query['ratingMin'],
      sort: query['sort']
    };
    const hintedService = String(apiQuery['service'] ?? '');
    return this.allPages<unknown>('professionals', apiQuery).pipe(
      map((items) =>
        items.map((item) => this.providerModel(item, hintedService ? [hintedService] : []))
      )
    );
  }
  providersPage(query: ApiQuery = {}) {
    const apiQuery: ApiQuery = {
      service: query['serviceId'] ?? query['service'],
      city: query['city'],
      state: query['state'],
      ratingMin: query['minRating'] ?? query['ratingMin'],
      sort: query['sort'],
      page: query['page'],
      perPage: query['perPage']
    };
    const hintedService = String(apiQuery['service'] ?? '');
    return this.api.getEnvelope<unknown[]>('professionals', apiQuery).pipe(
      map((response) => ({
        ...response,
        data: (response.data ?? []).map((item) =>
          this.providerModel(item, hintedService ? [hintedService] : [])
        )
      }))
    );
  }
  provider(id: string) {
    return this.api
      .get<unknown>(`professionals/${encodeURIComponent(id)}`)
      .pipe(map((item) => this.providerModel(item)));
  }
  providerReviewsPage(id: string, page = 1) {
    return this.api
      .getEnvelope<unknown[]>(`professionals/${encodeURIComponent(id)}/reviews`, {
        page,
        perPage: 20
      })
      .pipe(
        map((response) => ({
          ...response,
          data: (response.data ?? []).map((item) => this.reviewModel(item))
        }))
      );
  }
  providerReviews(id: string, page = 1) {
    return this.providerReviewsPage(id, page).pipe(map((response) => response.data));
  }
  providerCommentsPage(id: string, page = 1) {
    return this.api
      .getEnvelope<unknown[]>(`professionals/${encodeURIComponent(id)}/comments`, {
        page,
        perPage: 20
      })
      .pipe(
        map((response) => ({
          ...response,
          data: (response.data ?? []).map((item) => this.commentModel(item))
        }))
      );
  }
  providerComments(id: string, page = 1) {
    return this.providerCommentsPage(id, page).pipe(map((response) => response.data));
  }
  createProviderComment(id: string, comment: string) {
    return this.api
      .post<unknown>(`professionals/${encodeURIComponent(id)}/comments`, { comment })
      .pipe(map((item) => this.commentModel(item)));
  }
  startProfessionalConversation(id: string) {
    return this.api.post<{ conversationId: string }>(
      `professionals/${encodeURIComponent(id)}/conversation`,
      {}
    );
  }
  publicProviderAvailability(id: string, query: ApiQuery = {}) {
    return this.api.get<PublicAvailability>(
      `professionals/${encodeURIComponent(id)}/availability`,
      query
    );
  }
  lookupPostalCode(cep: string) {
    return this.api.get<PostalCodeAddress>(`postal-codes/${postalCodeDigits(cep)}`);
  }
  bookings(query: ApiQuery = {}) {
    return this.allPages<unknown>('bookings', query).pipe(
      map((items) => items.map((item) => this.bookingModel(item)))
    );
  }
  booking(id: string) {
    return this.api
      .get<unknown>(`bookings/${encodeURIComponent(id)}`)
      .pipe(map((item) => this.bookingModel(item)));
  }

  quote(draft: BookingDraft): Observable<BookingQuote> {
    return this.api
      .post<unknown>('bookings/quote', this.quotePayload(draft))
      .pipe(map((value) => this.quoteModel(value)));
  }

  createBooking(
    draft: BookingDraft,
    quote: BookingQuote,
    idempotencyKey: string
  ): Observable<Booking> {
    if (environment.useMockApi) {
      return this.api
        .post<unknown>(
          'bookings',
          { ...draft, quote },
          { headers: { 'Idempotency-Key': idempotencyKey } }
        )
        .pipe(map((item) => this.bookingModel(item)));
    }
    return this.ensureAddress(draft.address).pipe(
      switchMap((address) =>
        this.api.post<unknown>(
          'bookings',
          {
            ...this.quotePayload(draft),
            addressId: address.id,
            mode: draft.providerId ? 'direct' : 'marketplace',
            scheduledStart: `${draft.date}T${draft.time}:00`,
            timezone: 'America/Sao_Paulo',
            durationMinutes: quote.durationMinutes,
            quantity: quote.quantity,
            areaSqm: quote.areaSqm ?? draft.homeSize,
            notes: draft.notes || null
          },
          { headers: { 'Idempotency-Key': idempotencyKey } }
        )
      ),
      map((item) => this.bookingModel(item))
    );
  }

  confirmBooking(draft: BookingDraft, bookingKey: string): Observable<BookingConfirmation> {
    return this.quote(draft).pipe(
      switchMap((quote) => this.createBooking(draft, quote, bookingKey)),
      map((booking) => ({ booking, confirmed: booking.status === 'confirmed' }))
    );
  }

  cancelBooking(id: string, reason: string) {
    return this.api
      .post<unknown>(`bookings/${id}/cancel`, { reason })
      .pipe(map((item) => this.bookingModel(item)));
  }
  reviewBooking(id: string, rating: number, comment: string) {
    return this.api
      .post<unknown>(`bookings/${id}/reviews`, { rating, comment })
      .pipe(map((item) => this.reviewModel(item)));
  }
  bookingOffers(id: string) {
    return this.api
      .get<unknown[]>(`bookings/${encodeURIComponent(id)}/offers`)
      .pipe(map((items) => items.map((item) => this.offerModel(item))));
  }
  acceptBookingOffer(bookingId: string, offerId: string) {
    return this.api
      .post<unknown>(
        `bookings/${encodeURIComponent(bookingId)}/offers/${encodeURIComponent(offerId)}/accept`,
        {}
      )
      .pipe(map((item) => this.bookingModel(item)));
  }
  startBooking(id: string) {
    return this.api
      .post<unknown>(`bookings/${encodeURIComponent(id)}/start`, {})
      .pipe(map((item) => this.bookingModel(item)));
  }
  markBookingOnTheWay(id: string) {
    return this.api
      .post<unknown>(`bookings/${encodeURIComponent(id)}/on-the-way`, {})
      .pipe(map((item) => this.bookingModel(item)));
  }
  completeBooking(id: string) {
    return this.api
      .post<unknown>(`bookings/${encodeURIComponent(id)}/complete`, {})
      .pipe(map((item) => this.bookingModel(item)));
  }
  rescheduleBooking(id: string, date: string, time: string) {
    return this.api
      .post<unknown>(`bookings/${encodeURIComponent(id)}/reschedule`, {
        scheduledStart: `${date}T${time}:00`,
        timezone: 'America/Sao_Paulo'
      })
      .pipe(map((item) => this.bookingModel(item)));
  }
  conversationsPage(query: ApiQuery = {}) {
    return this.api
      .getEnvelope<unknown[]>('conversations', {
        page: query['page'],
        perPage: query['perPage'] ?? 30
      })
      .pipe(
        map((response) => ({
          ...response,
          data: (response.data ?? []).map((item) => this.conversationModel(item))
        }))
      );
  }
  conversations() {
    return this.conversationsPage().pipe(map((response) => response.data));
  }
  conversationMessages(id: string, query: ApiQuery = {}) {
    return this.api
      .get<unknown[]>(`conversations/${id}/messages`, query)
      .pipe(map((items) => items.map((item) => this.chatMessageModel(item))));
  }
  conversationMessageUpdates(id: string, after: number) {
    return this.api
      .get<unknown[]>(`conversations/${encodeURIComponent(id)}/events`, { after, limit: 50 })
      .pipe(map((items) => items.map((item) => this.chatMessageModel(item))));
  }
  sendMessage(id: string, body: string, idempotencyKey: string) {
    return this.api
      .post<unknown>(
        `conversations/${encodeURIComponent(id)}/messages`,
        { body },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
      .pipe(map((item) => this.chatMessageModel(item)));
  }
  markConversationRead(id: string, lastSequence: number) {
    return this.api.post<void>(`conversations/${id}/read`, { lastSequence });
  }

  notifications(query: ApiQuery = {}) {
    return this.api.getEnvelope<AppNotification[]>('me/notifications', query).pipe(
      map((response) => ({
        ...response,
        data: response.data.map((item) => ({
          ...item,
          createdAt: this.normalizeDate(item.createdAt),
          readAt: item.readAt ? this.normalizeDate(item.readAt) : item.readAt
        }))
      }))
    );
  }
  readNotification(id: string) {
    return this.api.post<void>(`me/notifications/${encodeURIComponent(id)}/read`, {});
  }
  readAllNotifications() {
    return this.api.post<void>('me/notifications/read-all', {});
  }

  metrics(portal: 'customer' | 'provider' | 'admin') {
    if (portal === 'customer')
      return this.bookings().pipe(map((bookings) => this.customerMetrics(bookings)));
    return this.api
      .get<unknown>(`${portal}/dashboard`)
      .pipe(map((response) => this.dashboardMetricsFor(portal, response)));
  }

  customerMetrics(bookings: Booking[]): DashboardMetric[] {
    return [
      {
        label: 'Agendados',
        value: String(
          bookings.filter((item) => !['completed', 'cancelled'].includes(item.status)).length
        ),
        hint: 'Em acompanhamento',
        tone: 'brand'
      },
      {
        label: 'Concluídos',
        value: String(bookings.filter((item) => item.status === 'completed').length),
        hint: 'No seu histórico',
        tone: 'neutral'
      },
      {
        label: 'Valores de referência',
        value: this.money(
          bookings
            .filter((item) =>
              ['confirmed', 'provider_on_the_way', 'in_progress', 'completed'].includes(item.status)
            )
            .reduce(
              (sum, item) =>
                sum +
                this.localization.convertAmount(item.price.totalCents, item.price.currency, 'BRL'),
              0
            )
        ),
        hint: 'Reservas confirmadas',
        tone: 'amber'
      }
    ];
  }

  dashboardMetricsFor(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    return this.dashboardMetrics(portal, value);
  }

  favorite(providerId: string, active = true) {
    return active
      ? this.api.post<unknown>(`me/favorites/${providerId}`, {})
      : this.api.delete<void>(`me/favorites/${providerId}`);
  }
  favorites() {
    return this.api
      .get<unknown[]>('me/favorites')
      .pipe(map((items) => items.map((item) => this.providerModel(item))));
  }
  addresses() {
    return this.api.get<Address[]>('me/addresses');
  }
  createAddress(address: Address) {
    return this.api.post<Address>('me/addresses', address);
  }
  updateAddress(id: string, address: Address) {
    return this.api.put<Address>(`me/addresses/${encodeURIComponent(id)}`, address);
  }
  removeAddress(id: string) {
    return this.api.delete<void>(`me/addresses/${encodeURIComponent(id)}`);
  }

  providerDashboard() {
    return this.api.get<ProviderDashboard>('provider/dashboard');
  }
  providerProfile() {
    return this.api.get<Record<string, unknown>>('provider/profile');
  }
  updateProviderProfile(payload: Record<string, unknown>) {
    return this.api.patch<Record<string, unknown>>('provider/profile', payload);
  }
  providerExperiences() {
    return this.api
      .get<unknown[]>('provider/profile/experiences')
      .pipe(map((items) => items.map((item) => this.experienceModel(item))));
  }
  createProviderExperience(payload: Omit<ProfessionalExperience, 'id'>) {
    return this.api
      .post<unknown>('provider/profile/experiences', payload)
      .pipe(map((item) => this.experienceModel(item)));
  }
  updateProviderExperience(id: string, payload: Omit<ProfessionalExperience, 'id'>) {
    return this.api
      .put<unknown>(`provider/profile/experiences/${encodeURIComponent(id)}`, payload)
      .pipe(map((item) => this.experienceModel(item)));
  }
  removeProviderExperience(id: string) {
    return this.api.delete<void>(`provider/profile/experiences/${encodeURIComponent(id)}`);
  }
  providerCourses() {
    return this.api
      .get<unknown[]>('provider/profile/courses')
      .pipe(map((items) => items.map((item) => this.courseModel(item))));
  }
  createProviderCourse(payload: Omit<ProfessionalCourse, 'id'>) {
    return this.api
      .post<unknown>('provider/profile/courses', payload)
      .pipe(map((item) => this.courseModel(item)));
  }
  updateProviderCourse(id: string, payload: Omit<ProfessionalCourse, 'id'>) {
    return this.api
      .put<unknown>(`provider/profile/courses/${encodeURIComponent(id)}`, payload)
      .pipe(map((item) => this.courseModel(item)));
  }
  removeProviderCourse(id: string) {
    return this.api.delete<void>(`provider/profile/courses/${encodeURIComponent(id)}`);
  }
  providerServices() {
    return this.api
      .get<ProviderService[]>('provider/services')
      .pipe(map((items) => items.map((item) => this.providerServiceModel(item))));
  }
  createCustomProviderService(payload: { name: string; priceCents: number }) {
    return this.api
      .post<ProviderService>('provider/services', payload)
      .pipe(map((item) => this.providerServiceModel(item)));
  }
  updateProviderService(id: string, payload: { priceCents: number; active: boolean }) {
    return this.api
      .put<ProviderService>(`provider/services/${id}`, payload)
      .pipe(map((item) => this.providerServiceModel(item)));
  }
  removeProviderService(id: string) {
    return this.api.delete<void>(`provider/services/${id}`);
  }
  providerAvailability() {
    return this.api.get<AvailabilityRule[]>('provider/availability');
  }
  saveProviderAvailability(rules: AvailabilityRule[]) {
    return this.api.put<AvailabilityRule[]>('provider/availability', {
      rules: rules.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))
    });
  }
  providerAvailabilityExceptions() {
    return this.api.get<AvailabilityException[]>('provider/availability-exceptions');
  }
  createProviderAvailabilityException(payload: Omit<AvailabilityException, 'id'>) {
    return this.api.post<AvailabilityException>('provider/availability-exceptions', payload);
  }
  removeProviderAvailabilityException(id: string) {
    return this.api.delete<void>(`provider/availability-exceptions/${encodeURIComponent(id)}`);
  }
  providerJobs() {
    return this.api.get<ProviderJob[]>('provider/jobs').pipe(
      map((items) =>
        items.map((item) => ({
          ...item,
          scheduledStart: this.normalizeDate(item.scheduledStart),
          scheduledEnd: item.scheduledEnd ? this.normalizeDate(item.scheduledEnd) : undefined
        }))
      )
    );
  }
  providerOpenRequests() {
    return this.api.get<ProviderRequest[]>('provider/open-requests').pipe(
      map((items) =>
        items.map((item) => ({
          ...item,
          scheduledStart: this.normalizeDate(item.scheduledStart),
          createdAt: this.normalizeDate(item.createdAt)
        }))
      )
    );
  }
  createOffer(bookingId: string, amountCents: number, message: string) {
    return this.api.post<unknown>(`provider/bookings/${bookingId}/offers`, {
      amountCents,
      message
    });
  }

  adminDashboard() {
    return this.api.get<Record<string, unknown>>('admin/dashboard');
  }
  adminUsers(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('admin/users', query);
  }
  adminPendingProviders(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('admin/professionals/pending', query);
  }
  adminBookings(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('admin/bookings', query);
  }
  adminContentReports(query: ApiQuery = {}) {
    return this.api.getEnvelope<unknown[]>('admin/content-reports', query);
  }
  adminResolveContentReport(id: string, action: 'hide' | 'retain', note: string) {
    return this.api.post<unknown>(`admin/content-reports/${encodeURIComponent(id)}/resolve`, {
      action,
      note
    });
  }
  reportContent(
    contentType: 'professional_comment' | 'review' | 'message',
    contentId: string,
    reason: string
  ) {
    return this.api.post<unknown>('content-reports', { contentType, contentId, reason });
  }
  adminCreateService(payload: Record<string, unknown>) {
    return this.api.post<unknown>('admin/services', payload);
  }
  adminPromotions() {
    return this.api
      .get<unknown[]>('admin/promotions')
      .pipe(map((items) => items.map((item) => this.promotionModel(item))));
  }
  adminCreatePromotion(payload: Record<string, unknown>) {
    return this.api.post<unknown>('admin/promotions', payload);
  }
  adminUpdatePromotion(id: string, payload: Record<string, unknown>) {
    return this.api.patch<unknown>(`admin/promotions/${encodeURIComponent(id)}`, payload);
  }
  adminProducts() {
    return this.api
      .get<unknown[]>('admin/products')
      .pipe(map((items) => items.map((item) => this.productModel(item))));
  }
  adminCreateProduct(payload: Record<string, unknown>) {
    return this.api.post<unknown>('admin/products', payload);
  }
  adminUpdateProduct(id: string, payload: Record<string, unknown>) {
    return this.api.patch<unknown>(`admin/products/${encodeURIComponent(id)}`, payload);
  }
  adminReviewProvider(id: string, status: 'approved' | 'rejected' | 'suspended', notes = '') {
    return this.api.post<unknown>(`admin/professionals/${id}/review`, { status, notes });
  }
  adminUserStatus(id: string, status: 'active' | 'suspended', reason = '') {
    return this.api.patch<unknown>(`admin/users/${id}/status`, { status, reason });
  }

  newIdempotencyKey(prefix: string): string {
    const value =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${value}`;
  }

  private category(value: unknown): ServiceCategory {
    const item = this.record(value);
    const name = this.string(item['name'], 'Serviço');
    return {
      id: this.string(item['id']),
      slug: this.string(item['slug']),
      name,
      shortName: this.string(item['shortName'], name),
      description: this.string(item['description']),
      symbol: this.string(item['symbol'] ?? item['icon'], this.initials(name)),
      serviceCount: this.number(item['serviceCount'] ?? item['servicesCount'])
    };
  }

  private serviceModel(value: unknown): Service {
    return this.mapper.serviceModel(value);
  }

  private providerServiceModel(value: ProviderService): ProviderService {
    const normalized = normalizeProviderServicePrices(value);
    return {
      ...normalized,
      active: this.boolean(value.active),
      isCustom: this.boolean(value.isCustom)
    };
  }

  private promotionModel(value: unknown): Promotion {
    return this.mapper.promotionModel(value);
  }

  private productModel(value: unknown): Product {
    return this.mapper.productModel(value);
  }

  private providerModel(value: unknown, hintedServices: string[] = []): ProviderProfile {
    return this.mapper.providerModel(value, hintedServices);
  }

  private reviewModel(value: unknown): Review {
    return this.mapper.reviewModel(value);
  }

  private commentModel(value: unknown): ProfessionalComment {
    return this.mapper.commentModel(value);
  }

  private experienceModel(value: unknown): ProfessionalExperience {
    return this.mapper.experienceModel(value);
  }

  private courseModel(value: unknown): ProfessionalCourse {
    return this.mapper.courseModel(value);
  }

  private bookingModel(value: unknown): Booking {
    return this.mapper.bookingModel(value);
  }

  private bookingStatus(value: string): BookingStatus {
    return this.mapper.bookingStatus(value);
  }

  private dashboardMetrics(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    return this.mapper.dashboardMetrics(portal, value);
  }

  private quotePayload(draft: BookingDraft): Record<string, unknown> {
    return this.mapper.quotePayload(draft);
  }

  private quoteModel(value: unknown): BookingQuote {
    return this.mapper.quoteModel(value);
  }

  private ensureAddress(address: Address): Observable<Address> {
    const normalize = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLocaleLowerCase('pt-BR');
    return this.api.get<Address[]>('me/addresses').pipe(
      map((items) =>
        items.find(
          (item) =>
            normalize(item.postalCode) === normalize(address.postalCode) &&
            normalize(item.street) === normalize(address.street) &&
            normalize(item.number) === normalize(address.number)
        )
      ),
      switchMap((existing) =>
        existing
          ? of(existing)
          : this.api.post<Address>('me/addresses', {
              ...address,
              label: address.label || 'Casa',
              isDefault: false
            })
      )
    );
  }

  private conversationModel(value: unknown): Conversation {
    return this.mapper.conversationModel(value);
  }

  private chatMessageModel(value: unknown): ChatMessage {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      sequence: this.number(item['sequence']),
      senderId: this.string(item['senderId']),
      senderName: this.string(item['senderName'], 'Usuário'),
      body: this.string(item['body']),
      messageType: this.string(item['messageType'], 'text'),
      createdAt: this.normalizeDate(this.string(item['createdAt']))
    };
  }

  private offerModel(value: unknown): BookingOffer {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      amountCents: this.number(item['amountCents']),
      message: this.string(item['message']),
      status: this.string(item['status'], 'pending'),
      expiresAt: this.normalizeDate(this.string(item['expiresAt'])),
      createdAt: this.normalizeDate(this.string(item['createdAt'])),
      professionalId: this.string(item['professionalId']),
      professionalName: this.string(item['professionalName'], 'Profissional'),
      rating: this.number(item['rating']),
      reviewsCount: this.number(item['reviewsCount'])
    };
  }

  private normalizeDate(value: string): string {
    return this.mapper.normalizeDate(value);
  }

  private allPages<T>(path: string, query: ApiQuery = {}): Observable<T[]> {
    const firstPage = Math.max(1, Number(query['page']) || 1);
    const perPage = Math.max(1, Math.min(50, Number(query['perPage']) || 50));
    return this.api.getEnvelope<T[]>(path, { ...query, page: firstPage, perPage }).pipe(
      expand((response) => {
        const page = Math.max(firstPage, Number(response.meta?.['page']) || firstPage);
        const lastPage = Math.max(page, Number(response.meta?.['lastPage']) || page);
        return page < lastPage
          ? this.api.getEnvelope<T[]>(path, { ...query, page: page + 1, perPage })
          : EMPTY;
      }),
      reduce((items, response) => {
        items.push(...(Array.isArray(response.data) ? response.data : []));
        return items;
      }, [] as T[])
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private record(value: unknown): UnknownRecord {
    return this.mapper.record(value);
  }
  private string(value: unknown, fallback = ''): string {
    return this.mapper.string(value, fallback);
  }
  private number(value: unknown, fallback = 0): number {
    return this.mapper.number(value, fallback);
  }
  private boolean(value: unknown): boolean {
    return apiBoolean(value);
  }
  private initials(name: string): string {
    return this.mapper.initials(name);
  }
  private money(cents: number): string {
    return this.mapper.money(cents);
  }
  private currency(value: unknown): AppCurrency {
    return this.mapper.currency(value);
  }
}
