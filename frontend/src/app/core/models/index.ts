export type UserRole = 'customer' | 'provider' | 'admin';
export type CurrencyCode = 'BRL' | 'EUR' | 'USD';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  initials: string;
  city: string;
  avatarUrl?: string | null;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken?: string;
  tokenType?: 'Bearer';
  expiresIn?: number;
}

export interface AuthSessionInfo {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  device: string;
  current: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  symbol: string;
  serviceCount: number;
}

export interface Service {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string;
  symbol: string;
  priceFromCents: number;
  unit: 'hora' | 'serviço' | 'diária' | 'm²';
  pricingType?: 'fixed' | 'hourly' | 'area';
  durationMinutes: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  addons?: ServiceAddon[];
  popular?: boolean;
}

export interface ServiceAddon {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  pricingType: 'fixed' | 'hourly' | 'quantity';
}

export interface Review {
  id: string;
  author: string;
  initials: string;
  rating: number;
  comment: string;
  createdAt: string;
  serviceName?: string;
  providerReply?: string;
  verifiedTransaction?: boolean;
}

export interface ProfessionalExperience {
  id: string;
  role: string;
  company: string;
  description?: string | null;
  startedAt: string;
  endedAt?: string | null;
  current: boolean;
}

export interface ProfessionalCourse {
  id: string;
  title: string;
  institution: string;
  completedAt?: string | null;
  certificateUrl?: string | null;
}

export interface ProfessionalComment {
  id: string;
  author: string;
  initials: string;
  comment: string;
  createdAt: string;
}

export interface ProviderProfile {
  id: string;
  name: string;
  initials: string;
  headline: string;
  bio: string;
  city: string;
  neighborhood: string;
  verified: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  topProvider?: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseTime: string;
  priceFromCents: number;
  serviceIds: string[];
  qualities: string[];
  nextAvailability: string;
  reviews: Review[];
  avatarUrl?: string | null;
  state?: string;
  yearsExperience?: number;
  memberSince?: string;
  experiences?: ProfessionalExperience[];
  courses?: ProfessionalCourse[];
}

export type BookingStatus =
  | 'open'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'provider_on_the_way'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface PriceBreakdown {
  subtotalCents: number;
  serviceFeeCents: number;
  discountCents: number;
  totalCents: number;
  currency: CurrencyCode;
}

export interface Address {
  id?: string;
  label?: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault?: boolean;
}

export interface BookingDraft {
  serviceId: string;
  homeSize: number;
  quantity: number;
  durationMinutes: number;
  addonIds: string[];
  notes: string;
  address: Address;
  date: string;
  time: string;
  providerId: string;
  currency: CurrencyCode;
}

export interface Booking {
  id: string;
  code: string;
  service: Service;
  provider: ProviderProfile;
  customerName: string;
  status: BookingStatus;
  scheduledAt: string;
  addressLabel: string;
  notes?: string;
  price: PriceBreakdown;
  canCancel: boolean;
  canReview: boolean;
  canMessage: boolean;
  conversationId?: string;
  allowedActions: string[];
  history?: BookingHistoryItem[];
}

export interface BookingHistoryItem {
  fromStatus?: string | null;
  toStatus: BookingStatus;
  reason?: string;
  createdAt: string;
}

export interface BookingOffer {
  id: string;
  amountCents: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | string;
  expiresAt: string;
  createdAt: string;
  professionalId: string;
  professionalName: string;
  rating: number;
  reviewsCount: number;
}

export interface QuoteItem {
  type: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface BookingQuote extends PriceBreakdown {
  serviceId: string;
  serviceName: string;
  pricingType: 'fixed' | 'hourly' | 'area';
  durationMinutes: number;
  quantity: number;
  areaSqm?: number;
  items: QuoteItem[];
}

export interface BookingConfirmation {
  booking: Booking;
  confirmed: boolean;
}

export interface Conversation {
  id: string;
  bookingId: string;
  bookingStatus: string;
  serviceName: string;
  contactName?: string;
  contactId?: string;
  contactAvatarUrl?: string | null;
  updatedAt: string;
  lastMessage: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  sequence: number;
  senderId: string;
  senderName: string;
  body: string;
  messageType: string;
  createdAt: string;
}

export interface ProviderDashboard {
  metrics: { upcomingJobs: number; completedJobs: number; openRequests: number; };
  profile: Record<string, unknown>;
}

export interface ProviderJob {
  id: string;
  status: BookingStatus;
  scheduledStart: string;
  scheduledEnd?: string;
  totalCents: number;
  serviceName: string;
  customerName: string;
  city: string;
  state: string;
  conversationId?: string;
  currency: CurrencyCode;
}

export interface ProviderRequest {
  id: string;
  scheduledStart: string;
  durationMinutes: number;
  quantity: number;
  areaSqm?: number;
  suggestedSubtotalCents: number;
  serviceName: string;
  city: string;
  state: string;
  createdAt: string;
  currency: CurrencyCode;
}

export interface ProviderService {
  id: string;
  name: string;
  slug: string;
  pricingType: string;
  catalogPriceCents: number;
  customPriceCents: number;
  active: boolean;
}

export interface AvailabilityRule {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface AvailabilityException {
  id?: string;
  date: string;
  type: 'available' | 'unavailable';
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

export interface PublicAvailability {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  slots: string[];
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface MessagePreview {
  id: string;
  bookingId: string;
  personName: string;
  initials: string;
  lastMessage: string;
  sentAt: string;
  unread: number;
}

export interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
  tone?: 'brand' | 'coral' | 'amber' | 'neutral';
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    requestId?: string;
  };
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly fields?: Record<string, string[]>,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
