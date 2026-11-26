<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Auth;

final class EmailVerificationCode
{
    public static function fromTokenHash(string $tokenHash, string $secret): string
    {
        // Derive a separate proof without storing a guessable six-digit value.
        $digest = hash_hmac('sha256', 'email-verification-code:' . $tokenHash, $secret);
        return sprintf('%06d', hexdec(substr($digest, 0, 7)) % 1000000);
    }
}
