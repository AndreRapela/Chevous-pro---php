<?php

declare(strict_types=1);

use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Modules\Admin\AdminController;
use ChezVoust\Modules\Auth\AuthController;
use ChezVoust\Modules\Bookings\BookingController;
use ChezVoust\Modules\Bookings\PricingService;
use ChezVoust\Modules\Catalog\CatalogController;
use ChezVoust\Modules\Engagement\EngagementController;
use ChezVoust\Modules\Professionals\ProviderController;
use ChezVoust\Modules\Users\AccountController;
use ChezVoust\Modules\Users\MediaController;

return static function (array $services): void {
    $router = $services['router'];
    $db = $services['db'];
    $config = $services['config'];

    $auth = new AuthController($db, $config, $services['jwt'], $services['rateLimiter'], $services['audit']);
    $catalog = new CatalogController($db, $config);
    $pricing = new PricingService($db, $config);
    $bookings = new BookingController($db, $config, $pricing, $services['audit']);
    $account = new AccountController($db, $config, $services['rateLimiter']);
    $media = new MediaController($db, $config);
    $engagement = new EngagementController($db, $config, $services['rateLimiter']);
    $provider = new ProviderController($db, $config);
    $admin = new AdminController($db, $config, $services['audit']);

    $router->add('GET', '/api/v1/health', static fn (Request $request, array $params, ?array $user): Response => Response::data([
        'status' => 'ok', 'service' => 'ChezVoust Pro API', 'version' => '1.0.0', 'time' => gmdate(DATE_ATOM),
    ]));
    $router->add('GET', '/api/v1/seo/robots.txt', [$catalog, 'robots']);
    $router->add('GET', '/api/v1/seo/sitemap.xml', [$catalog, 'sitemap']);
    $router->add('GET', '/api/v1/app-config', [$catalog, 'appConfig']);
    $router->add('GET', '/api/v1/home', [$catalog, 'home']);
    $router->add('GET', '/api/v1/categories', [$catalog, 'categories']);
    $router->add('GET', '/api/v1/avatars/{id}', [$media, 'avatar']);
    $router->add('GET', '/api/v1/services', [$catalog, 'services']);
    $router->add('GET', '/api/v1/services/{id}', [$catalog, 'service']);
    $router->add('GET', '/api/v1/professionals', [$catalog, 'professionals']);
    $router->add('GET', '/api/v1/professionals/{id}', [$catalog, 'professional']);
    $router->add('GET', '/api/v1/professionals/{id}/availability', [$catalog, 'availability']);
    $router->add('GET', '/api/v1/professionals/{id}/reviews', [$engagement, 'professionalReviews']);
    $router->add('GET', '/api/v1/professionals/{id}/comments', [$engagement, 'professionalComments']);
    $router->add('POST', '/api/v1/professionals/{id}/comments', [$engagement, 'createProfessionalComment'], true);
    $router->add('GET', '/api/v1/providers', [$catalog, 'professionals']);
    $router->add('GET', '/api/v1/providers/{id}', [$catalog, 'professional']);
    $router->add('GET', '/api/v1/providers/{id}/availability', [$catalog, 'availability']);
    $router->add('GET', '/api/v1/providers/{id}/reviews', [$engagement, 'professionalReviews']);

    $router->add('POST', '/api/v1/auth/register/customer', [$auth, 'registerCustomer']);
    $router->add('POST', '/api/v1/auth/register/provider', [$auth, 'registerProvider']);
    $router->add('POST', '/api/v1/auth/register', [$auth, 'registerGeneric']);
    $router->add('POST', '/api/v1/auth/login', [$auth, 'login']);
    $router->add('POST', '/api/v1/auth/refresh', [$auth, 'refresh']);
    $router->add('POST', '/api/v1/auth/password/forgot', [$auth, 'forgotPassword']);
    $router->add('POST', '/api/v1/auth/password/reset', [$auth, 'resetPassword']);
    $router->add('POST', '/api/v1/auth/forgot-password', [$auth, 'forgotPassword']);
    $router->add('POST', '/api/v1/auth/reset-password', [$auth, 'resetPassword']);
    $router->add('POST', '/api/v1/auth/email/verify', [$auth, 'verifyEmail']);
    $router->add('POST', '/api/v1/auth/logout', [$auth, 'logout'], true);
    $router->add('POST', '/api/v1/auth/logout-all', [$auth, 'logoutAll'], true);
    $router->add('GET', '/api/v1/auth/sessions', [$auth, 'sessions'], true);
    $router->add('DELETE', '/api/v1/auth/sessions/{id}', [$auth, 'revokeSession'], true);
    $router->add('POST', '/api/v1/auth/password/change', [$auth, 'changePassword'], true);

    $router->add('GET', '/api/v1/me', [$auth, 'me'], true);
    $router->add('PATCH', '/api/v1/me', [$auth, 'updateMe'], true);
    $router->add('POST', '/api/v1/me/avatar', [$account, 'updateAvatar'], true);
    $router->add('GET', '/api/v1/me/addresses', [$account, 'addresses'], true);
    $router->add('POST', '/api/v1/me/addresses', [$account, 'createAddress'], true);
    $router->add('PUT', '/api/v1/me/addresses/{id}', [$account, 'updateAddress'], true);
    $router->add('DELETE', '/api/v1/me/addresses/{id}', [$account, 'deleteAddress'], true);
    $router->add('GET', '/api/v1/me/favorites', [$engagement, 'favorites'], true, ['customer']);
    $router->add('POST', '/api/v1/me/favorites/{professionalId}', [$engagement, 'addFavorite'], true, ['customer']);
    $router->add('DELETE', '/api/v1/me/favorites/{professionalId}', [$engagement, 'removeFavorite'], true, ['customer']);
    $router->add('GET', '/api/v1/me/notifications', [$engagement, 'notifications'], true);
    $router->add('POST', '/api/v1/me/notifications/read-all', [$engagement, 'readAllNotifications'], true);
    $router->add('POST', '/api/v1/me/notifications/{id}/read', [$engagement, 'readNotification'], true);
    $router->add('GET', '/api/v1/notifications', [$engagement, 'notifications'], true);
    $router->add('POST', '/api/v1/notifications/read-all', [$engagement, 'readAllNotifications'], true);
    $router->add('POST', '/api/v1/notifications/{id}/read', [$engagement, 'readNotification'], true);

    $router->add('POST', '/api/v1/bookings/quote', [$bookings, 'quote'], true, ['customer']);
    $router->add('POST', '/api/v1/quotes', [$bookings, 'quote'], true, ['customer']);
    $router->add('POST', '/api/v1/bookings', [$bookings, 'create'], true, ['customer']);
    $router->add('GET', '/api/v1/bookings', [$bookings, 'index'], true);
    $router->add('GET', '/api/v1/bookings/{id}', [$bookings, 'show'], true);
    $router->add('GET', '/api/v1/bookings/{id}/offers', [$bookings, 'offers'], true, ['customer', 'admin']);
    $router->add('POST', '/api/v1/offers/{offerId}/accept', [$bookings, 'acceptOffer'], true, ['customer']);
    $router->add('POST', '/api/v1/bookings/{id}/offers/{offerId}/accept', [$bookings, 'acceptOffer'], true, ['customer']);
    $router->add('POST', '/api/v1/bookings/{id}/cancel', [$bookings, 'cancel'], true);
    $router->add('POST', '/api/v1/bookings/{id}/reschedule', [$bookings, 'reschedule'], true, ['customer', 'admin']);
    $router->add('POST', '/api/v1/bookings/{id}/on-the-way', [$bookings, 'onTheWay'], true, ['provider', 'admin']);
    $router->add('POST', '/api/v1/bookings/{id}/start', [$bookings, 'start'], true, ['provider', 'admin']);
    $router->add('POST', '/api/v1/bookings/{id}/complete', [$bookings, 'complete'], true, ['provider', 'admin']);
    $router->add('POST', '/api/v1/bookings/{id}/reviews', [$engagement, 'createReview'], true, ['customer']);
    $router->add('POST', '/api/v1/reviews/{id}/reply', [$engagement, 'replyToReview'], true, ['provider']);
    $router->add('POST', '/api/v1/content-reports', [$engagement, 'reportContent'], true);

    $router->add('GET', '/api/v1/conversations', [$engagement, 'conversations'], true);
    $router->add('GET', '/api/v1/conversations/{id}/messages', [$engagement, 'messages'], true);
    $router->add('GET', '/api/v1/conversations/{id}/events', [$engagement, 'messageUpdates'], true);
    $router->add('POST', '/api/v1/conversations/{id}/messages', [$engagement, 'sendMessage'], true);
    $router->add('POST', '/api/v1/conversations/{id}/read', [$engagement, 'markRead'], true);

    $router->add('GET', '/api/v1/provider/dashboard', [$provider, 'dashboard'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/profile', [$provider, 'profile'], true, ['provider']);
    $router->add('PATCH', '/api/v1/provider/profile', [$provider, 'updateProfile'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/profile/experiences', [$provider, 'experiences'], true, ['provider']);
    $router->add('POST', '/api/v1/provider/profile/experiences', [$provider, 'createExperience'], true, ['provider']);
    $router->add('PUT', '/api/v1/provider/profile/experiences/{id}', [$provider, 'updateExperience'], true, ['provider']);
    $router->add('DELETE', '/api/v1/provider/profile/experiences/{id}', [$provider, 'deleteExperience'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/profile/courses', [$provider, 'courses'], true, ['provider']);
    $router->add('POST', '/api/v1/provider/profile/courses', [$provider, 'createCourse'], true, ['provider']);
    $router->add('PUT', '/api/v1/provider/profile/courses/{id}', [$provider, 'updateCourse'], true, ['provider']);
    $router->add('DELETE', '/api/v1/provider/profile/courses/{id}', [$provider, 'deleteCourse'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/services', [$provider, 'services'], true, ['provider']);
    $router->add('PUT', '/api/v1/provider/services/{serviceId}', [$provider, 'upsertService'], true, ['provider']);
    $router->add('DELETE', '/api/v1/provider/services/{serviceId}', [$provider, 'removeService'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/availability', [$provider, 'availability'], true, ['provider']);
    $router->add('PUT', '/api/v1/provider/availability', [$provider, 'replaceAvailability'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/availability-exceptions', [$provider, 'availabilityExceptions'], true, ['provider']);
    $router->add('POST', '/api/v1/provider/availability-exceptions', [$provider, 'createAvailabilityException'], true, ['provider']);
    $router->add('DELETE', '/api/v1/provider/availability-exceptions/{id}', [$provider, 'deleteAvailabilityException'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/jobs', [$provider, 'jobs'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/open-requests', [$provider, 'openRequests'], true, ['provider']);
    $router->add('GET', '/api/v1/provider/opportunities', [$provider, 'openRequests'], true, ['provider']);
    $router->add('POST', '/api/v1/provider/bookings/{bookingId}/offers', [$provider, 'createOffer'], true, ['provider']);
    $router->add('POST', '/api/v1/provider/offers/{offerId}/withdraw', [$provider, 'withdrawOffer'], true, ['provider']);

    $router->add('GET', '/api/v1/admin/dashboard', [$admin, 'dashboard'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/users', [$admin, 'users'], true, ['admin']);
    $router->add('PATCH', '/api/v1/admin/users/{id}/status', [$admin, 'setUserStatus'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/professionals/pending', [$admin, 'pendingProfessionals'], true, ['admin']);
    $router->add('POST', '/api/v1/admin/professionals/{id}/review', [$admin, 'reviewProfessional'], true, ['admin']);
    $router->add('POST', '/api/v1/admin/categories', [$admin, 'createCategory'], true, ['admin']);
    $router->add('PATCH', '/api/v1/admin/categories/{id}', [$admin, 'updateCategory'], true, ['admin']);
    $router->add('POST', '/api/v1/admin/services', [$admin, 'createService'], true, ['admin']);
    $router->add('PATCH', '/api/v1/admin/services/{id}', [$admin, 'updateService'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/promotions', [$admin, 'promotions'], true, ['admin']);
    $router->add('POST', '/api/v1/admin/promotions', [$admin, 'createPromotion'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/bookings', [$bookings, 'index'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/audit-logs', [$admin, 'auditLogs'], true, ['admin']);
    $router->add('GET', '/api/v1/admin/content-reports', [$admin, 'contentReports'], true, ['admin']);
    $router->add('POST', '/api/v1/admin/content-reports/{id}/resolve', [$admin, 'resolveContentReport'], true, ['admin']);
};
