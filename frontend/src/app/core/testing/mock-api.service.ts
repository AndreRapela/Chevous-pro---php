import { Injectable } from '@angular/core';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { MOCK_BOOKINGS, MOCK_CATEGORIES, MOCK_PROVIDERS, MOCK_SERVICES } from './mock-data';
import { ApiClientError, ApiEnvelope, AppNotification, AuthSession, AvailabilityException, Booking, BookingDraft, BookingQuote, ChatMessage, Conversation, ProfessionalComment, ProfessionalCourse, ProfessionalExperience, Service, User, UserRole } from '../models';

type QueryValue = string | number | boolean | undefined;
type QueryParams = Record<string, QueryValue>;
type Row = Record<string, unknown>;
interface Credentials { email?: string; password?: string; name?: string; phone?: string; remember?: boolean; }

@Injectable({ providedIn: 'root' })
export class MockApiService {
  private servicesState: Service[] = [...MOCK_SERVICES];
  private bookings = [...MOCK_BOOKINGS];
  private addresses: Row[] = [{ id: 'addr-demo', label: 'Casa', postalCode: '04001-000', street: 'Rua das Flores', number: '120', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP' }];
  private favorites = [...MOCK_PROVIDERS.slice(0, 2)];
  private activeUser: User | null = null;
  private providerProfile: Row = { id: 'ana-clara', name: 'Ana Clara Souza', email: 'profissional@chezvoust.test', phone: '11999990000', headline: 'Especialista em limpeza residencial', bio: 'Atendimento cuidadoso e organizado.', yearsExperience: 6, baseCity: 'São Paulo', baseState: 'SP', serviceRadiusKm: 10, verificationStatus: 'approved', rating: 4.96, reviewsCount: 128, completedJobs: 214 };
  private providerServicesState = MOCK_SERVICES.slice(0, 3).map((service) => ({ id: service.id, name: service.name, slug: service.slug, pricingType: this.pricingType(service), catalogPriceCents: service.priceFromCents, customPriceCents: service.priceFromCents, active: true }));
  private availabilityState = [{ id: 'av-1', weekday: 1, startTime: '08:00', endTime: '17:00' }, { id: 'av-2', weekday: 3, startTime: '08:00', endTime: '17:00' }, { id: 'av-3', weekday: 5, startTime: '08:00', endTime: '16:00' }];
  private availabilityExceptionsState: AvailabilityException[] = [];
  private notificationsState: AppNotification[] = [
    { id: 'notification-1', type: 'booking_confirmed', title: 'Reserva confirmada', message: 'Sua limpeza residencial foi confirmada.', data: { bookingId: 'bk-1001' }, readAt: null, createdAt: '2026-08-19T10:42:00-03:00' },
    { id: 'notification-2', type: 'welcome', title: 'Bem-vindo à ChezVoust', message: 'Seu perfil está pronto para reservar serviços.', data: null, readAt: '2026-08-18T09:00:00-03:00', createdAt: '2026-08-18T08:45:00-03:00' }
  ];
  private openRequestsState: Row[] = [{ id: 'request-1', scheduledStart: '2026-08-21T09:30:00-03:00', durationMinutes: 240, quantity: 1, areaSqm: 82, suggestedSubtotalCents: 14400, serviceName: 'Limpeza residencial', city: 'São Paulo', state: 'SP', createdAt: '2026-08-19T10:00:00-03:00', currency: 'BRL' }];
  private conversationsState: Conversation[] = [{ id: 'conversation-1', bookingId: 'bk-1001', bookingStatus: 'confirmed', serviceName: 'Limpeza residencial', contactName: 'Ana Clara Souza', contactId: 'ana-clara', contactAvatarUrl: '/images/garconete-cadastro-v1-640.webp', updatedAt: '2026-08-19T10:42:00-03:00', lastMessage: 'Perfeito! Chego alguns minutos antes.', unreadCount: 1 }];
  private chatState: Record<string, ChatMessage[]> = { 'conversation-1': [{ id: 'chat-1', sequence: 1, senderId: 'provider-1', senderName: 'Ana Clara Souza', body: 'Perfeito! Chego alguns minutos antes.', messageType: 'text', createdAt: '2026-08-19T10:42:00-03:00' }] };
  private commentsState: Record<string, ProfessionalComment[]> = {
    'ana-clara': [
      { id: 'comment-1', author: 'Paula N.', initials: 'PN', comment: 'Muito atenciosa desde o primeiro contato.', createdAt: '2026-08-15T10:00:00-03:00' },
      { id: 'comment-2', author: 'Caio M.', initials: 'CM', comment: 'Gostei da organização e das atualizações antes do atendimento.', createdAt: '2026-08-11T10:00:00-03:00' }
    ],
    'lucas-mendes': [
      { id: 'comment-3', author: 'Aline P.', initials: 'AP', comment: 'Foi educado ao explicar o que precisava ser feito.', createdAt: '2026-08-09T10:00:00-03:00' },
      { id: 'comment-4', author: 'João R.', initials: 'JR', comment: 'Chegou no horário combinado e manteve o ambiente organizado.', createdAt: '2026-08-04T10:00:00-03:00' }
    ]
  };
  private experiencesState: ProfessionalExperience[] = [{ id: 'experience-1', role: 'Especialista em limpeza residencial', company: 'Atuação autônoma', description: 'Atendimento residencial com organização e cuidado nos detalhes.', startedAt: '2019-01-01', endedAt: null, current: true }];
  private coursesState: ProfessionalCourse[] = [{ id: 'course-1', title: 'Higienização e limpeza profissional', institution: 'Instituto Casa', completedAt: '2022-10-01', certificateUrl: null }];

  request<T>(method: string, path: string, body?: unknown, params: QueryParams = {}): Observable<ApiEnvelope<T>> {
    const normalized = path.replace(/^\//, '').split('?')[0] ?? '';
    return timer(120).pipe(mergeMap(() => this.resolve(method.toUpperCase(), normalized, body, params) as Observable<ApiEnvelope<T>>));
  }

  private resolve(method: string, path: string, body: unknown, params: QueryParams): Observable<ApiEnvelope<unknown>> {
    if (method === 'GET' && path === 'categories') return this.ok(MOCK_CATEGORIES);
    if (method === 'GET' && path === 'services') {
      const category = String(params['category'] ?? '').trim(); const professional = String(params['professional'] ?? '').trim(); const q = String(params['q'] ?? '').trim().toLocaleLowerCase('pt-BR');
      const categoryId = MOCK_CATEGORIES.find((item) => item.id === category || item.slug === category)?.id ?? category;
      const professionalServices = professional ? MOCK_PROVIDERS.find((item) => item.id === professional)?.serviceIds ?? [] : null;
      const items = this.servicesState.filter((item) => (!categoryId || item.categoryId === categoryId) && (!professionalServices || professionalServices.includes(item.id)) && (!q || `${item.name} ${item.description} ${item.slug}`.toLocaleLowerCase('pt-BR').includes(q)));
      const paginated = this.paginate(items, params);
      return this.ok(paginated.items, paginated.meta);
    }
    if (method === 'GET' && /^services\//.test(path)) { const id = decodeURIComponent(path.slice(9)); const item = this.servicesState.find((service) => service.id === id || service.slug === id); return item ? this.ok(item) : this.notFound('Serviço não encontrado.'); }
    if (method === 'GET' && path === 'professionals') {
      const service = String(params['service'] ?? params['serviceId'] ?? ''); const city = String(params['city'] ?? '').toLocaleLowerCase('pt-BR'); const rating = Number(params['ratingMin'] ?? params['minRating'] ?? 0);
      const items = MOCK_PROVIDERS.filter((item) => (!service || item.serviceIds.includes(service)) && (!city || item.city.toLocaleLowerCase('pt-BR').includes(city)) && item.rating >= rating);
      const paginated = this.paginate(items, params);
      return this.ok(paginated.items, paginated.meta);
    }
    const publicReviews = path.match(/^professionals\/([^/]+)\/reviews$/);
    if (method === 'GET' && publicReviews) {
      const provider = MOCK_PROVIDERS.find((item) => item.id === decodeURIComponent(publicReviews[1] ?? ''));
      if (!provider) return this.notFound('Profissional não encontrado.');
      const paginated = this.paginate(provider.reviews, params);
      return this.ok(paginated.items, paginated.meta);
    }
    const publicComments = path.match(/^professionals\/([^/]+)\/comments$/);
    if (method === 'GET' && publicComments) {
      const id = decodeURIComponent(publicComments[1] ?? '');
      if (!MOCK_PROVIDERS.some((item) => item.id === id)) return this.notFound('Profissional não encontrado.');
      const paginated = this.paginate(this.commentsState[id] ?? [], params);
      return this.ok(paginated.items, paginated.meta);
    }
    if (method === 'POST' && publicComments) { const id = decodeURIComponent(publicComments[1] ?? ''); const value = body as Row; const comment: ProfessionalComment = { id: `comment-${Date.now()}`, author: this.currentUser().name, initials: this.currentUser().initials, comment: String(value['comment'] ?? '').trim(), createdAt: new Date().toISOString() }; this.commentsState[id] = [comment, ...(this.commentsState[id] ?? [])]; return this.ok(comment); }
    const publicAvailability = path.match(/^professionals\/([^/]+)\/availability$/); if (method === 'GET' && publicAvailability) return this.publicAvailability(params);
    if (method === 'GET' && /^professionals\//.test(path)) { const id = decodeURIComponent(path.slice(14)); const item = MOCK_PROVIDERS.find((provider) => provider.id === id); return item ? this.ok(item) : this.notFound('Profissional não encontrado.'); }
    const inquiry = path.match(/^professionals\/([^/]+)\/conversation$/); if (method === 'POST' && inquiry) { const professional = MOCK_PROVIDERS.find((item) => item.id === decodeURIComponent(inquiry[1] ?? '')); const user = this.currentUser(); if (!professional) return this.notFound('Profissional não encontrado.'); if (user.role !== 'customer') return this.fail('forbidden', 'Apenas clientes podem iniciar esta conversa.', 403); const current = this.conversationsState.find((item) => item.bookingStatus === 'inquiry' && item.contactId === professional.id); if (current) return this.ok({ conversationId: current.id }); const conversationId = `conversation-${Date.now()}`; this.conversationsState = [{ id: conversationId, bookingId: '', bookingStatus: 'inquiry', serviceName: 'Contato antes da reserva', contactName: professional.name, contactId: professional.id, contactAvatarUrl: professional.avatarUrl, updatedAt: new Date().toISOString(), lastMessage: '', unreadCount: 0 }, ...this.conversationsState]; this.chatState[conversationId] = []; return this.ok({ conversationId }); }

    if (method === 'POST' && path === 'auth/login') return this.login(body as Credentials);
    if (method === 'POST' && path === 'auth/refresh') { const user = this.currentUser(); return this.ok({ user, accessToken: `mock-access-${user.role}`, tokenType: 'Bearer', expiresIn: 3600 }); }
    if (method === 'POST' && /^auth\/register\/(customer|provider)$/.test(path)) { const value = body as Credentials; const role: UserRole = path.endsWith('provider') ? 'provider' : 'customer'; const name = String(value.name ?? 'Nova conta'); return this.ok({ user: { id: `${role}-${Date.now()}`, name, email: String(value.email ?? ''), phone: String(value.phone ?? ''), role, initials: this.initials(name), city: 'São Paulo' }, message: 'Conta criada.' }); }
    if (method === 'POST' && path === 'auth/password/forgot') return this.ok({ message: 'Se a conta existir, enviaremos as instruções.' });
    if (method === 'POST' && path === 'auth/password/reset') return this.ok({ message: 'Senha atualizada com sucesso.' });
    if (method === 'POST' && path === 'auth/email/verify') return this.ok({ message: 'E-mail verificado com sucesso.' });
    if (method === 'POST' && path === 'auth/password/change') return this.ok({ message: 'Senha atualizada.' });
    if (method === 'POST' && path === 'auth/logout') { this.activeUser = null; return this.ok(undefined); }
    if (method === 'POST' && path === 'auth/logout-all') { this.activeUser = null; return this.ok(undefined); }
    if (method === 'GET' && path === 'auth/sessions') return this.ok([{ id: 'mock-session-current', ipAddress: '127.0.0.1', userAgent: 'Mock browser', device: 'Navegador de demonstração', current: true, createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() }]);
    if (method === 'DELETE' && /^auth\/sessions\/[^/]+$/.test(path)) return this.ok(undefined);
    if (method === 'GET' && path === 'me') return this.ok(this.currentUser());
    if (method === 'PATCH' && path === 'me') { const value = body as Partial<User>; this.activeUser = { ...this.currentUser(), ...value }; return this.ok(this.activeUser); }
    if (method === 'POST' && path === 'me/avatar') { this.activeUser = { ...this.currentUser(), avatarUrl: '/images/garconete-cadastro-v1-640.webp' }; return this.ok(this.activeUser); }
    if (method === 'GET' && path === 'me/addresses') return this.ok(this.addresses);
    if (method === 'POST' && path === 'me/addresses') { const address = { ...(body as Row), id: `addr-${Date.now()}` }; this.addresses.push(address); return this.ok(address); }
    const address = path.match(/^me\/addresses\/([^/]+)$/); if (method === 'PUT' && address) { const value = { ...(body as Row), id: address[1] }; this.addresses = this.addresses.map((item) => item['id'] === address[1] ? value : item); return this.ok(value); } if (method === 'DELETE' && address) { this.addresses = this.addresses.filter((item) => item['id'] !== address[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'me/favorites') return this.ok(this.favorites);
    const favorite = path.match(/^me\/favorites\/([^/]+)$/); if (favorite && method === 'POST') { const provider = MOCK_PROVIDERS.find((item) => item.id === favorite[1]); if (provider && !this.favorites.some((item) => item.id === provider.id)) this.favorites.push(provider); return this.ok(undefined); } if (favorite && method === 'DELETE') { this.favorites = this.favorites.filter((item) => item.id !== favorite[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'me/notifications') { const page = Math.max(1, Number(params['page']) || 1); const perPage = Math.max(1, Math.min(100, Number(params['perPage']) || 20)); const start = (page - 1) * perPage; return this.ok(this.notificationsState.slice(start, start + perPage), { page, perPage, total: this.notificationsState.length, lastPage: Math.max(1, Math.ceil(this.notificationsState.length / perPage)), unreadCount: this.notificationsState.filter((item) => !item.readAt).length }); }
    if (method === 'POST' && path === 'me/notifications/read-all') { const now = new Date().toISOString(); this.notificationsState = this.notificationsState.map((item) => ({ ...item, readAt: item.readAt ?? now })); return this.ok(undefined); }
    const notificationRead = path.match(/^me\/notifications\/([^/]+)\/read$/); if (method === 'POST' && notificationRead) { const now = new Date().toISOString(); this.notificationsState = this.notificationsState.map((item) => item.id === notificationRead[1] ? { ...item, readAt: item.readAt ?? now } : item); return this.ok(undefined); }

    if (method === 'POST' && path === 'bookings/quote') return this.quote(body as Row);
    if (method === 'GET' && path === 'bookings') return this.ok(this.bookings);
    if (method === 'POST' && path === 'bookings') return this.createBooking(body as BookingDraft & { quote?: BookingQuote });
    const bookingId = path.match(/^bookings\/([^/]+)$/); if (method === 'GET' && bookingId) { const item = this.bookings.find((booking) => booking.id === bookingId[1]); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }
    const offers = path.match(/^bookings\/([^/]+)\/offers$/); if (method === 'GET' && offers) return this.ok([]);
    const acceptOffer = path.match(/^bookings\/([^/]+)\/offers\/([^/]+)\/accept$/); if (method === 'POST' && acceptOffer) return this.notFound('Proposta não encontrada.');
    const cancel = path.match(/^bookings\/([^/]+)\/cancel$/); if (method === 'POST' && cancel) { const item = this.updateBooking(cancel[1] ?? '', { status: 'cancelled', canCancel: false, allowedActions: [] }); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }
    const reschedule = path.match(/^bookings\/([^/]+)\/reschedule$/); if (method === 'POST' && reschedule) { const value = body as Row; const item = this.updateBooking(reschedule[1] ?? '', { scheduledAt: String(value['scheduledStart']), allowedActions: ['cancel', 'reschedule', 'message'] }); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }
    const review = path.match(/^bookings\/([^/]+)\/reviews$/); if (method === 'POST' && review) { const value = body as Row; this.updateBooking(review[1] ?? '', { canReview: false, allowedActions: [] }); return this.ok({ id: `review-${Date.now()}`, rating: Number(value['rating']), comment: String(value['comment'] ?? ''), customerName: 'Marina Costa', createdAt: new Date().toISOString() }); }
    const startBooking = path.match(/^bookings\/([^/]+)\/start$/); if (method === 'POST' && startBooking) { const item = this.updateBooking(startBooking[1] ?? '', { status: 'in_progress', allowedActions: ['complete', 'message'] }); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }
    const onTheWay = path.match(/^bookings\/([^/]+)\/on-the-way$/); if (method === 'POST' && onTheWay) { const item = this.updateBooking(onTheWay[1] ?? '', { status: 'provider_on_the_way', allowedActions: ['start', 'message'] }); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }
    const completeBooking = path.match(/^bookings\/([^/]+)\/complete$/); if (method === 'POST' && completeBooking) { const item = this.updateBooking(completeBooking[1] ?? '', { status: 'completed', canCancel: false, allowedActions: ['message'] }); return item ? this.ok(item) : this.notFound('Reserva não encontrada.'); }

    if (method === 'GET' && path === 'conversations') { const page = Math.max(1, Number(params['page']) || 1); const perPage = Math.max(1, Math.min(100, Number(params['perPage']) || 30)); const total = this.conversationsState.length; return this.ok(this.conversationsState.slice((page - 1) * perPage, page * perPage), { page, perPage, total, lastPage: Math.max(1, Math.ceil(total / perPage)) }); }
    const messageEvents = path.match(/^conversations\/([^/]+)\/events$/); if (method === 'GET' && messageEvents) { const after = Math.max(0, Number(params['after']) || 0); const list = this.chatState[messageEvents[1] ?? ''] ?? []; return this.ok(list.filter((message) => message.sequence > after).slice(0, 50)); }
    const messages = path.match(/^conversations\/([^/]+)\/messages$/); if (method === 'GET' && messages) { const after = Math.max(0, Number(params['after']) || 0); const before = Math.max(0, Number(params['before']) || 0); const limit = Math.max(1, Math.min(100, Number(params['limit']) || 50)); const list = this.chatState[messages[1] ?? ''] ?? []; return this.ok(before ? list.filter((message) => message.sequence < before).slice(-limit) : list.filter((message) => message.sequence > after).slice(0, limit)); } if (method === 'POST' && messages) { const id = messages[1] ?? ''; const list = this.chatState[id] ?? []; const value = body as Row; const user = this.currentUser(); const message: ChatMessage = { id: `chat-${Date.now()}`, sequence: (list.at(-1)?.sequence ?? 0) + 1, senderId: user.id, senderName: user.name, body: String(value['body'] ?? ''), messageType: 'text', createdAt: new Date().toISOString() }; this.chatState[id] = [...list, message]; this.conversationsState = this.conversationsState.map((conversation) => conversation.id === id ? { ...conversation, lastMessage: message.body, updatedAt: message.createdAt } : conversation); return this.ok(message); }
    const read = path.match(/^conversations\/([^/]+)\/read$/); if (method === 'POST' && read) { this.conversationsState = this.conversationsState.map((item) => item.id === read[1] ? { ...item, unreadCount: 0 } : item); return this.ok(undefined); }

    if (method === 'GET' && path === 'provider/dashboard') return this.ok({ metrics: { upcomingJobs: 1, completedJobs: 214, openRequests: this.openRequestsState.length }, profile: this.providerProfile });
    if (method === 'GET' && path === 'provider/profile') return this.ok(this.providerProfile);
    if (method === 'PATCH' && path === 'provider/profile') { this.providerProfile = { ...this.providerProfile, ...(body as Row) }; return this.ok(this.providerProfile); }
    if (method === 'GET' && path === 'provider/profile/experiences') return this.ok(this.experiencesState);
    if (method === 'POST' && path === 'provider/profile/experiences') { const experience = { id: `experience-${Date.now()}`, ...(body as Omit<ProfessionalExperience, 'id'>) }; this.experiencesState = [experience, ...this.experiencesState]; return this.ok(experience); }
    const experience = path.match(/^provider\/profile\/experiences\/([^/]+)$/); if (method === 'PUT' && experience) { const value = { id: experience[1] ?? '', ...(body as Omit<ProfessionalExperience, 'id'>) }; this.experiencesState = this.experiencesState.map((item) => item.id === experience[1] ? value : item); return this.ok(value); } if (method === 'DELETE' && experience) { this.experiencesState = this.experiencesState.filter((item) => item.id !== experience[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'provider/profile/courses') return this.ok(this.coursesState);
    if (method === 'POST' && path === 'provider/profile/courses') { const course = { id: `course-${Date.now()}`, ...(body as Omit<ProfessionalCourse, 'id'>) }; this.coursesState = [course, ...this.coursesState]; return this.ok(course); }
    const course = path.match(/^provider\/profile\/courses\/([^/]+)$/); if (method === 'PUT' && course) { const value = { id: course[1] ?? '', ...(body as Omit<ProfessionalCourse, 'id'>) }; this.coursesState = this.coursesState.map((item) => item.id === course[1] ? value : item); return this.ok(value); } if (method === 'DELETE' && course) { this.coursesState = this.coursesState.filter((item) => item.id !== course[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'provider/services') return this.ok(this.providerServicesState);
    const providerService = path.match(/^provider\/services\/([^/]+)$/); if (method === 'PUT' && providerService) { const value = body as Row; this.providerServicesState = this.providerServicesState.map((item) => item.id === providerService[1] ? { ...item, customPriceCents: Number(value['priceCents']), active: Boolean(value['active']) } : item); return this.ok(this.providerServicesState.find((item) => item.id === providerService[1])); } if (method === 'DELETE' && providerService) { this.providerServicesState = this.providerServicesState.filter((item) => item.id !== providerService[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'provider/availability') return this.ok(this.availabilityState);
    if (method === 'PUT' && path === 'provider/availability') { this.availabilityState = ((body as Row)['rules'] as typeof this.availabilityState) ?? []; return this.ok(this.availabilityState); }
    if (method === 'GET' && path === 'provider/availability-exceptions') return this.ok(this.availabilityExceptionsState);
    if (method === 'POST' && path === 'provider/availability-exceptions') { const item = { ...(body as Omit<AvailabilityException, 'id'>), id: `exception-${Date.now()}` }; this.availabilityExceptionsState = [...this.availabilityExceptionsState, item]; return this.ok(item); }
    const providerException = path.match(/^provider\/availability-exceptions\/([^/]+)$/); if (method === 'DELETE' && providerException) { this.availabilityExceptionsState = this.availabilityExceptionsState.filter((item) => item.id !== providerException[1]); return this.ok(undefined); }
    if (method === 'GET' && path === 'provider/jobs') return this.ok(this.bookings.map((booking) => this.providerJob(booking)));
    if (method === 'GET' && path === 'provider/open-requests') return this.ok(this.openRequestsState);
    const offer = path.match(/^provider\/bookings\/([^/]+)\/offers$/); if (method === 'POST' && offer) { this.openRequestsState = this.openRequestsState.filter((item) => item['id'] !== offer[1]); return this.ok({ id: `offer-${Date.now()}`, bookingId: offer[1], ...(body as Row) }); }

    if (method === 'GET' && path === 'admin/dashboard') return this.ok({ metrics: { bookings: this.bookings.length, confirmedBookings: this.bookings.filter((item) => item.status === 'confirmed').length, completedBookings: this.bookings.filter((item) => item.status === 'completed').length, professionalsPending: 1, professionals: MOCK_PROVIDERS.length, customers: 3 }, recentBookings: this.bookings.map((item) => this.adminBooking(item)) });
    if (method === 'GET' && path === 'admin/users') { const role = String(params['role'] ?? ''); const users = this.adminUsers().filter((item) => !role || item['role'] === role); return this.ok(users, { total: users.length }); }
    if (method === 'GET' && path === 'admin/professionals/pending') return this.ok([{ id: 'pending-provider', name: 'Paulo Nascimento', email: 'paulo@exemplo.test', phone: '11911112222', headline: 'Jardinagem', bio: '', city: 'Campinas', state: 'SP', yearsExperience: 3, verificationStatus: 'pending', createdAt: '2026-08-18 12:00:00' }], { total: 1 });
    if (method === 'GET' && path === 'admin/bookings') return this.ok(this.bookings.map((item) => this.adminBooking(item)), { total: this.bookings.length });
    if (method === 'POST' && path === 'admin/services') { const value = body as Row; const name = String(value['name'] ?? 'Novo serviço'); const service: Service = { id: `service-${Date.now()}`, categoryId: String(value['categoryId'] ?? ''), slug: name.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, description: String(value['shortDescription'] ?? ''), symbol: this.initials(name), priceFromCents: Number(value['priceCents']) || 0, unit: value['pricingType'] === 'hourly' ? 'hora' : value['pricingType'] === 'area' ? 'm²' : 'serviço', pricingType: String(value['pricingType'] ?? 'fixed') as Service['pricingType'], durationMinutes: Number(value['defaultDurationMinutes']) || 120 }; this.servicesState = [...this.servicesState, service]; return this.ok(service); }
    if (method === 'POST' && /^admin\/professionals\/[^/]+\/review$/.test(path)) return this.ok({ success: true });
    if (method === 'PATCH' && /^admin\/users\/[^/]+\/status$/.test(path)) return this.ok({ success: true });
    return this.notFound('Recurso de demonstração não encontrado.');
  }

  private login(credentials: Credentials): Observable<ApiEnvelope<unknown>> { const accounts = this.accounts(); const account = accounts[String(credentials.email ?? '').toLocaleLowerCase('pt-BR')]; if (!account || !String(credentials.password ?? '').trim()) return this.fail('invalid_credentials', 'E-mail ou senha incorretos.', 401); this.activeUser = account; const session: AuthSession = { user: account, accessToken: `mock-access-${account.role}`, tokenType: 'Bearer', expiresIn: 3600 }; return this.ok(session); }
  private quote(value: Row): Observable<ApiEnvelope<unknown>> {
    const service = this.servicesState.find((item) => item.id === value['serviceId']);
    if (!service) return this.notFound('Serviço não encontrado.');
    const pricingType = this.pricingType(service); const area = Math.max(1, Number(value['areaSqm']) || 1); const quantity = Math.max(1, Number(value['quantity']) || 1); const duration = Math.max(30, Number(value['durationMinutes']) || service.durationMinutes); const requestedCurrency = String(value['currency'] ?? 'BRL'); const currency = requestedCurrency === 'USD' || requestedCurrency === 'EUR' ? requestedCurrency : 'BRL'; const exchangeRate = currency === 'USD' ? 0.20 : currency === 'EUR' ? 0.17 : 1;
    const unitPriceCents = Math.round(service.priceFromCents * exchangeRate); const base = pricingType === 'area' ? Math.round(unitPriceCents * area) : pricingType === 'hourly' ? Math.round(unitPriceCents * duration / 60) : unitPriceCents * quantity;
    const addonIds = Array.isArray(value['addonIds']) ? value['addonIds'].map(String) : []; const addons = (service.addons ?? []).filter((item) => addonIds.includes(item.id)); const addonTotal = addons.reduce((sum, item) => sum + Math.round(item.priceCents * exchangeRate), 0); const subtotal = base + addonTotal;
    return this.ok({ serviceId: service.id, serviceName: service.name, pricingType, durationMinutes: duration, quantity, areaSqm: pricingType === 'area' ? area : undefined, items: [{ type: 'service', name: service.name, quantity, unitPriceCents, totalCents: base }, ...addons.map((item) => { const priceCents = Math.round(item.priceCents * exchangeRate); return { type: 'addon', name: item.name, quantity: 1, unitPriceCents: priceCents, totalCents: priceCents }; })], subtotalCents: subtotal, discountCents: 0, serviceFeeCents: 0, totalCents: subtotal, currency });
  }
  private createBooking(value: BookingDraft & { quote?: BookingQuote }): Observable<ApiEnvelope<unknown>> {
    const service = this.servicesState.find((item) => item.id === value.serviceId);
    const selectedProvider = MOCK_PROVIDERS.find((item) => item.id === value.providerId);
    if (!service || (value.providerId && !selectedProvider)) return this.notFound('Serviço ou profissional indisponível.');
    const provider = selectedProvider ?? { ...MOCK_PROVIDERS[0]!, id: '', name: 'Profissional a definir', initials: '?' };
    const quote = value.quote;
    const subtotal = quote?.subtotalCents ?? service.priceFromCents;
    const fee = quote?.serviceFeeCents ?? 0;
    const discount = quote?.discountCents ?? 0;
    const conversationId = `conversation-${Date.now()}`;
    const isMarketplace = !value.providerId;
    const booking: Booking = {
      id: `bk-${Date.now()}`, code: `CVP-${String(Date.now()).slice(-6)}`, service, provider,
      customerName: this.currentUser().name, status: isMarketplace ? 'open' : 'confirmed',
      scheduledAt: `${value.date}T${value.time}:00-03:00`, addressLabel: `${value.address.neighborhood}, ${value.address.city}`,
      notes: value.notes,
      price: { subtotalCents: subtotal, serviceFeeCents: fee, discountCents: discount, totalCents: quote?.totalCents ?? subtotal + fee - discount, currency: value.currency },
      canCancel: true, canReview: false, canMessage: !isMarketplace, conversationId,
      allowedActions: isMarketplace ? ['cancel', 'offers'] : ['cancel', 'message']
    };
    this.bookings = [booking, ...this.bookings];
    this.conversationsState = [{ id: conversationId, bookingId: booking.id, bookingStatus: booking.status, serviceName: service.name, updatedAt: new Date().toISOString(), lastMessage: '', unreadCount: 0 }, ...this.conversationsState];
    this.chatState[conversationId] = [];
    return this.ok(booking);
  }
  private updateBooking(id: string, changes: Partial<Booking>): Booking | undefined { let result: Booking | undefined; this.bookings = this.bookings.map((item) => { if (item.id !== id) return item; result = { ...item, ...changes }; return result; }); return result; }
  private providerJob(booking: Booking): Row { return { id: booking.id, status: booking.status, scheduledStart: booking.scheduledAt, totalCents: booking.price.totalCents, currency: booking.price.currency, serviceName: booking.service.name, customerName: booking.customerName, city: booking.addressLabel.split(', ').at(-1) ?? '', state: 'SP', conversationId: booking.conversationId }; }
  private publicAvailability(params: QueryParams): Observable<ApiEnvelope<unknown>> { const date = String(params['date'] ?? ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return this.ok({ rules: this.availabilityState, exceptions: this.availabilityExceptionsState, slots: [] }); const weekday = new Date(`${date}T12:00:00`).getDay(); const duration = Math.max(30, Number(params['durationMinutes']) || 60); const blocked = this.availabilityExceptionsState.some((item) => item.date === date && item.type === 'unavailable' && !item.startTime && !item.endTime); const slots: string[] = []; if (!blocked) for (const rule of this.availabilityState.filter((item) => item.weekday === weekday)) { let cursor = this.minutes(rule.startTime); const end = this.minutes(rule.endTime); while (cursor + duration <= end) { const slot = this.clock(cursor); const conflict = this.availabilityExceptionsState.some((item) => item.date === date && item.type === 'unavailable' && item.startTime && item.endTime && cursor < this.minutes(item.endTime) && cursor + duration > this.minutes(item.startTime)); if (!conflict) slots.push(slot); cursor += 30; } } return this.ok({ rules: this.availabilityState, exceptions: this.availabilityExceptionsState.filter((item) => item.date === date), slots }); }
  private minutes(time: string): number { const [hour = '0', minute = '0'] = time.split(':'); return Number(hour) * 60 + Number(minute); }
  private clock(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
  private adminBooking(booking: Booking): Row { return { id: booking.id, status: booking.status, scheduledStart: booking.scheduledAt, totalCents: booking.price.totalCents, createdAt: '2026-08-19 12:00:00', customerName: booking.customerName, professionalName: booking.provider.name, serviceName: booking.service.name }; }
  private adminUsers(): Row[] { return [{ id: 'customer-1', role: 'customer', name: 'Marina Costa', email: 'cliente@chezvoust.test', phone: '11999991234', status: 'active', createdAt: '2026-01-10 12:00:00' }, { id: 'provider-1', role: 'provider', name: 'Ana Clara Souza', email: 'profissional@chezvoust.test', phone: '11999990000', status: 'active', createdAt: '2026-01-12 12:00:00' }]; }
  private currentUser(): User { return this.activeUser ?? Object.values(this.accounts())[0]!; }
  private accounts(): Record<string, User> { return { 'cliente@chezvoust.test': { id: 'customer-1', name: 'Marina Costa', email: 'cliente@chezvoust.test', phone: '11999991234', role: 'customer', initials: 'MC', city: 'São Paulo' }, 'profissional@chezvoust.test': { id: 'provider-1', name: 'Ana Clara Souza', email: 'profissional@chezvoust.test', role: 'provider', initials: 'AS', city: 'São Paulo' }, 'admin@chezvoust.test': { id: 'admin-1', name: 'Caio Martins', email: 'admin@chezvoust.test', role: 'admin', initials: 'CM', city: 'São Paulo' } }; }
  private pricingType(service: { unit: string }): 'fixed' | 'hourly' | 'area' { return service.unit === 'hora' ? 'hourly' : service.unit === 'm²' ? 'area' : 'fixed'; }
  private initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''); }
  private paginate<T>(items: T[], params: QueryParams): { items: T[]; meta: Record<string, number> } {
    const perPage = Math.max(1, Math.min(50, Number(params['perPage']) || 20));
    const lastPage = Math.max(1, Math.ceil(items.length / perPage));
    const page = Math.min(lastPage, Math.max(1, Number(params['page']) || 1));
    return { items: items.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total: items.length, lastPage } };
  }
  private ok<T>(data: T, meta?: Record<string, unknown>): Observable<ApiEnvelope<T>> { return of({ data, ...(meta ? { meta } : {}) }); }
  private fail(code: string, message: string, status: number): Observable<never> { return throwError(() => new ApiClientError(code, message, status, undefined, 'mock-request')); }
  private notFound(message: string): Observable<never> { return this.fail('not_found', message, 404); }
}
