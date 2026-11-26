<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Catalog;

final class ServiceVisibility
{
    public static function inCatalog(string $service = 's'): string
    {
        $eligible = self::eligibleProfessional('offer_user', 'offer_profile');
        return "{$service}.active = 1 AND ({$service}.provider_created = 0 OR EXISTS (
            SELECT 1 FROM professional_services offer
            INNER JOIN users offer_user ON offer_user.id = offer.professional_id
            INNER JOIN professional_profiles offer_profile ON offer_profile.user_id = offer_user.id
            WHERE offer.service_id = {$service}.id AND offer.active = 1 AND {$eligible}
        ))";
    }

    public static function forProfessional(string $service = 's', string $user = 'u', string $profile = 'p'): string
    {
        $eligible = self::eligibleProfessional($user, $profile);
        return "{$service}.active = 1 AND ({$service}.provider_created = 0 OR ({$eligible}))";
    }

    public static function eligibleProfessional(string $user = 'u', string $profile = 'p'): string
    {
        return "{$user}.role = 'provider' AND {$user}.status = 'active' AND {$user}.deleted_at IS NULL
            AND {$user}.email_verified_at IS NOT NULL AND {$profile}.verification_status = 'approved'";
    }
}
