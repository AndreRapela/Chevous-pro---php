import { apiBoolean } from '../http/api-value.util';
import type { AppCurrency, LocalizationService } from '../localization/localization.service';
import type {
  Booking,
  BookingDraft,
  BookingQuote,
  BookingStatus,
  Conversation,
  DashboardMetric,
  Product,
  ProfessionalComment,
  ProfessionalCourse,
  ProfessionalExperience,
  Promotion,
  ProviderProfile,
  Review,
  Service
} from '../models';
type UnknownRecord = Record<string, unknown>;

/** Converts API DTOs to presentation models; it does not perform HTTP or mutate application state. */
export class MarketplaceMapper {
  constructor(private readonly localization: LocalizationService) {}
  serviceModel(value: unknown): Service {
    const item = this.record(value);
    const name = this.string(item['name'], 'Serviço');
    const pricingType = this.string(item['pricingType'], 'fixed') as Service['pricingType'];
    const unitLabel = this.string(
      item['unit'] ?? item['unitLabel'],
      pricingType === 'area' ? 'm²' : 'serviço'
    ).toLocaleLowerCase('pt-BR');
    const unit: Service['unit'] =
      pricingType === 'area' || unitLabel.includes('m²')
        ? 'm²'
        : unitLabel.includes('hora')
          ? 'hora'
          : unitLabel.includes('diária')
            ? 'diária'
            : 'serviço';
    const rawAddons = Array.isArray(item['addons']) ? item['addons'] : [];
    return {
      id: this.string(item['id']),
      categoryId: this.string(item['categoryId']),
      slug: this.string(item['slug']),
      name,
      description: this.string(item['description'] ?? item['shortDescription']),
      symbol: this.string(item['symbol'], this.initials(name)),
      priceFromCents: this.number(item['priceFromCents'] ?? item['priceCents']),
      unit,
      pricingType,
      durationMinutes: this.number(item['durationMinutes'] ?? item['defaultDurationMinutes'], 120),
      minimumQuantity: this.number(item['minimumQuantity'], 1),
      maximumQuantity: this.number(item['maximumQuantity'], 10000),
      addons: rawAddons.map((raw) => {
        const addon = this.record(raw);
        return {
          id: this.string(addon['id']),
          name: this.string(addon['name']),
          description: this.string(addon['description']),
          priceCents: this.number(addon['priceCents']),
          pricingType: this.string(addon['pricingType'], 'fixed') as 'fixed' | 'hourly' | 'quantity'
        };
      }),
      popular: this.boolean(item['popular']),
      isCustom: this.boolean(item['isCustom'])
    };
  }
  promotionModel(value: unknown): Promotion {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      title: this.string(item['title'], 'Produtos para sua casa'),
      subtitle: this.string(item['subtitle']),
      ctaLabel: this.string(item['ctaLabel'], 'Ver produtos'),
      ctaUrl: this.string(item['ctaUrl'], '/produtos'),
      imageUrl: this.string(item['imageUrl']) || null,
      badgeText: this.string(item['badgeText'], 'Novidades na loja'),
      termsText: this.string(item['termsText']),
      backgroundColor: this.string(item['backgroundColor'], '#096653'),
      textColor: this.string(item['textColor'], '#FFFFFF'),
      active: item['active'] === undefined ? true : this.boolean(item['active']),
      startsAt: this.string(item['startsAt']) || null,
      endsAt: this.string(item['endsAt']) || null,
      sortOrder: this.number(item['sortOrder'])
    };
  }
  productModel(value: unknown): Product {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      name: this.string(item['name'], 'Produto'),
      slug: this.string(item['slug']),
      shortDescription: this.string(item['shortDescription']),
      priceCents: this.number(item['priceCents']),
      compareAtPriceCents:
        item['compareAtPriceCents'] == null ? null : this.number(item['compareAtPriceCents']),
      currency: this.currency(item['currency']),
      imageUrl: this.string(item['imageUrl']) || null,
      purchaseUrl: this.string(item['purchaseUrl'], '/ajuda'),
      badgeText: this.string(item['badgeText']),
      inventoryCount: this.number(item['inventoryCount']),
      featured: this.boolean(item['featured']),
      active: item['active'] === undefined ? true : this.boolean(item['active']),
      sortOrder: this.number(item['sortOrder'])
    };
  }
  providerModel(value: unknown, hintedServices: string[] = []): ProviderProfile {
    const item = this.record(value);
    const name = this.string(item['name'], 'Profissional');
    const rawServices = Array.isArray(item['services']) ? item['services'] : [];
    const serviceIds = Array.isArray(item['serviceIds'])
      ? item['serviceIds'].map(String)
      : typeof item['serviceIds'] === 'string'
        ? item['serviceIds'].split(',').filter(Boolean)
        : rawServices.map((service) => this.string(this.record(service)['id'])).filter(Boolean);
    const servicePrices = rawServices
      .map((service) => this.number(this.record(service)['priceCents']))
      .filter((price) => price > 0);
    const rawReviews = Array.isArray(item['reviews']) ? item['reviews'] : [];
    return {
      id: this.string(item['id']),
      name,
      initials: this.string(item['initials'], this.initials(name)),
      headline: this.string(item['headline'], 'Home services professional'),
      bio: this.string(item['bio'], 'Platform-approved professional profile.'),
      city: this.string(item['city'] ?? item['baseCity'], 'City not specified'),
      neighborhood: this.string(item['neighborhood'] ?? item['state'] ?? item['baseState']),
      verified:
        this.boolean(item['verified']) || this.string(item['verificationStatus']) === 'approved',
      verificationStatus: this.string(
        item['verificationStatus'],
        'pending'
      ) as ProviderProfile['verificationStatus'],
      topProvider: this.boolean(item['topProvider'] ?? item['featured']),
      rating: this.number(item['rating'], 0),
      reviewCount: this.number(item['reviewCount'] ?? item['reviewsCount']),
      completedJobs: this.number(item['completedJobs']),
      responseTime: this.string(item['responseTime'], 'Replies through the platform'),
      priceFromCents: this.number(
        item['priceFromCents'],
        servicePrices.length ? Math.min(...servicePrices) : 0
      ),
      serviceIds: [...new Set([...serviceIds, ...hintedServices])],
      qualities: Array.isArray(item['qualities'])
        ? item['qualities'].map(String)
        : ['Approved profile', 'In-platform support'],
      nextAvailability: this.string(item['nextAvailability'], 'Check the schedule'),
      reviews: rawReviews.map((review) => this.reviewModel(review)),
      avatarUrl: this.string(item['avatarUrl']) || null,
      state: this.string(item['state'] ?? item['baseState']) || undefined,
      yearsExperience: this.number(item['yearsExperience']),
      memberSince: this.string(item['memberSince']) || undefined,
      experiences: Array.isArray(item['experiences'])
        ? item['experiences'].map((experience) => this.experienceModel(experience))
        : [],
      courses: Array.isArray(item['courses'])
        ? item['courses'].map((course) => this.courseModel(course))
        : []
    };
  }
  reviewModel(value: unknown): Review {
    const item = this.record(value);
    const author = this.string(item['author'] ?? item['customerName'], 'Cliente');
    return {
      id: this.string(item['id']),
      author,
      initials: this.string(item['initials'], this.initials(author)),
      rating: this.number(item['rating'], 5),
      comment: this.string(item['comment']),
      createdAt: this.string(item['createdAt'], new Date().toISOString()),
      serviceName: this.string(item['serviceName']) || undefined,
      providerReply: this.string(item['providerReply']) || undefined,
      verifiedTransaction: true
    };
  }
  commentModel(value: unknown): ProfessionalComment {
    const item = this.record(value);
    const author = this.string(item['author'], 'Membro da comunidade');
    return {
      id: this.string(item['id']),
      author,
      initials: this.string(item['initials'], this.initials(author)),
      comment: this.string(item['comment']),
      createdAt: this.normalizeDate(this.string(item['createdAt']))
    };
  }
  experienceModel(value: unknown): ProfessionalExperience {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      role: this.string(item['role']),
      company: this.string(item['company']),
      description: this.string(item['description']) || null,
      startedAt: this.string(item['startedAt']),
      endedAt: this.string(item['endedAt']) || null,
      current: this.number(item['current']) === 1
    };
  }
  courseModel(value: unknown): ProfessionalCourse {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      title: this.string(item['title']),
      institution: this.string(item['institution']),
      completedAt: this.string(item['completedAt']) || null,
      certificateUrl: this.string(item['certificateUrl']) || null
    };
  }
  bookingModel(value: unknown): Booking {
    const item = this.record(value);
    if (item['service'] && item['provider'] && item['price']) {
      const booking = value as Booking;
      return {
        ...booking,
        price: { ...booking.price, currency: this.currency(booking.price.currency) },
        history: booking.history ?? [],
        canMessage: Boolean(booking.canMessage ?? booking.conversationId),
        allowedActions:
          booking.allowedActions ??
          [
            booking.canCancel ? 'cancel' : '',
            booking.canReview ? 'review' : '',
            booking.canMessage ? 'message' : ''
          ].filter(Boolean)
      };
    }
    const status = this.bookingStatus(this.string(item['status']));
    const serviceName = this.string(item['serviceName'], 'Serviço doméstico');
    const professionalName = this.string(item['professionalName'], 'Profissional a definir');
    const pricing = this.record(item['pricingSnapshot']);
    const totalCents = this.number(item['totalCents'] ?? pricing['totalCents']);
    const address = this.record(item['addressSnapshot']);
    const actions = Array.isArray(item['allowedActions']) ? item['allowedActions'].map(String) : [];
    const history = Array.isArray(item['history'])
      ? item['history'].map((entry) => {
          const row = this.record(entry);
          return {
            fromStatus: this.string(row['fromStatus']) || null,
            toStatus: this.bookingStatus(this.string(row['toStatus'])),
            reason: this.string(row['reason']),
            createdAt: this.normalizeDate(this.string(row['createdAt']))
          };
        })
      : [];
    return {
      id: this.string(item['id']),
      code: this.string(item['code'], `CVP-${this.string(item['id']).slice(0, 8).toUpperCase()}`),
      service: {
        id: this.string(item['serviceId']),
        categoryId: '',
        slug: '',
        name: serviceName,
        description: '',
        symbol: this.initials(serviceName),
        priceFromCents: totalCents,
        unit: 'serviço',
        durationMinutes: this.number(item['durationMinutes'], 120)
      },
      provider: {
        id: this.string(item['professionalId']),
        name: professionalName,
        initials: this.initials(professionalName),
        headline: '',
        bio: '',
        city: '',
        neighborhood: '',
        verified: true,
        rating: 5,
        reviewCount: 0,
        completedJobs: 0,
        responseTime: '',
        priceFromCents: 0,
        serviceIds: [],
        qualities: [],
        nextAvailability: '',
        reviews: []
      },
      customerName: this.string(item['customerName'], 'Cliente'),
      status,
      scheduledAt: this.normalizeDate(this.string(item['scheduledAt'] ?? item['scheduledStart'])),
      addressLabel:
        [this.string(address['neighborhood']), this.string(address['city'])]
          .filter(Boolean)
          .join(', ') || 'Endereço da reserva',
      notes: this.string(item['notes']),
      price: {
        subtotalCents: this.number(item['subtotalCents'] ?? pricing['subtotalCents'], totalCents),
        serviceFeeCents: this.number(item['serviceFeeCents'] ?? pricing['serviceFeeCents']),
        discountCents: this.number(item['discountCents'] ?? pricing['discountCents']),
        totalCents,
        currency: this.currency(item['currency'] ?? pricing['currency'])
      },
      canCancel: actions.length
        ? actions.includes('cancel')
        : ['open', 'confirmed'].includes(status),
      canReview: actions.length ? actions.includes('review') : Boolean(item['canReview']),
      canMessage: actions.length ? actions.includes('message') : Boolean(item['conversationId']),
      conversationId: this.string(item['conversationId']) || undefined,
      allowedActions: actions,
      history
    };
  }
  bookingStatus(value: string): BookingStatus {
    const statuses: Record<string, BookingStatus> = {
      open: 'open',
      awaiting_confirmation: 'awaiting_confirmation',
      confirmed: 'confirmed',
      provider_on_the_way: 'provider_on_the_way',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
      disputed: 'disputed'
    };
    return statuses[value] ?? 'awaiting_confirmation';
  }
  dashboardMetrics(portal: 'provider' | 'admin', value: unknown): DashboardMetric[] {
    if (Array.isArray(value)) return value as DashboardMetric[];
    const data = this.record(value);
    const metrics = this.record(data['metrics']);
    if (portal === 'provider') {
      const profile = this.record(data['profile']);
      return [
        {
          label: 'Serviços concluídos',
          value: String(this.number(metrics['completedJobs'])),
          hint: 'Atendimentos finalizados',
          tone: 'brand'
        },
        {
          label: 'Novas solicitações',
          value: String(this.number(metrics['openRequests'])),
          hint: 'Oportunidades disponíveis',
          tone: 'coral'
        },
        {
          label: 'Próximos serviços',
          value: String(this.number(metrics['upcomingJobs'])),
          hint: 'Confirmados na agenda',
          tone: 'neutral'
        },
        {
          label: 'Sua avaliação',
          value: this.number(profile['rating'], 5).toFixed(2).replace('.', ','),
          hint: `${this.number(profile['reviewsCount'])} avaliações`,
          tone: 'amber'
        }
      ];
    }
    return [
      {
        label: 'Reservas',
        value: String(this.number(metrics['bookings'])),
        hint: `${this.number(metrics['confirmedBookings'])} confirmadas`,
        tone: 'brand'
      },
      {
        label: 'Concluídas',
        value: String(this.number(metrics['completedBookings'])),
        hint: 'Atendimentos finalizados',
        tone: 'amber'
      },
      {
        label: 'Prestadores em análise',
        value: String(this.number(metrics['professionalsPending'])),
        hint: `${this.number(metrics['professionals'])} cadastrados`,
        tone: 'coral'
      },
      {
        label: 'Clientes',
        value: String(this.number(metrics['customers'])),
        hint: 'Contas na plataforma',
        tone: 'neutral'
      }
    ];
  }
  quotePayload(draft: BookingDraft): Record<string, unknown> {
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
  quoteModel(value: unknown): BookingQuote {
    const item = this.record(value);
    const pricingType = this.string(item['pricingType'], 'fixed') as BookingQuote['pricingType'];
    const rawItems = Array.isArray(item['items']) ? item['items'] : [];
    return {
      serviceId: this.string(item['serviceId']),
      serviceName: this.string(item['serviceName'], 'Serviço doméstico'),
      pricingType,
      durationMinutes: this.number(item['durationMinutes'], 120),
      quantity: this.number(item['quantity'], 1),
      areaSqm: item['areaSqm'] == null ? undefined : this.number(item['areaSqm']),
      items: rawItems.map((raw) => {
        const row = this.record(raw);
        return {
          type: this.string(row['type']),
          name: this.string(row['name']),
          quantity: this.number(row['quantity'], 1),
          unitPriceCents: this.number(row['unitPriceCents']),
          totalCents: this.number(row['totalCents'])
        };
      }),
      subtotalCents: this.number(item['subtotalCents']),
      serviceFeeCents: this.number(item['serviceFeeCents']),
      discountCents: this.number(item['discountCents']),
      totalCents: this.number(item['totalCents']),
      currency: this.currency(item['currency'])
    };
  }
  conversationModel(value: unknown): Conversation {
    const item = this.record(value);
    return {
      id: this.string(item['id']),
      bookingId: this.string(item['bookingId']),
      bookingStatus: this.string(item['bookingStatus']),
      serviceName: this.string(item['serviceName'], 'Serviço'),
      contactName: this.string(item['contactName']) || undefined,
      contactId: this.string(item['contactId']) || undefined,
      contactAvatarUrl: this.string(item['contactAvatarUrl']) || null,
      updatedAt: this.normalizeDate(this.string(item['updatedAt'])),
      lastMessage: this.string(item['lastMessage'], 'Conversa iniciada.'),
      unreadCount: this.number(item['unreadCount'])
    };
  }
  normalizeDate(value: string): string {
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value;
  }
  record(value: unknown): UnknownRecord {
    return value !== null && typeof value === 'object' ? (value as UnknownRecord) : {};
  }
  string(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }
  number(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  boolean(value: unknown): boolean {
    return apiBoolean(value);
  }
  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  money(cents: number): string {
    return this.localization.formatMoney(cents / 100, 'BRL', 0);
  }
  currency(value: unknown): AppCurrency {
    const currency = String(value).toUpperCase();
    return currency === 'USD' || currency === 'EUR' || currency === 'BRL' ? currency : 'BRL';
  }
}
