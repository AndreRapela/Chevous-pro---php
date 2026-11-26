<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Users;

use ChezVoust\Core\ApiException;

final class PostalCode
{
    public static function normalize(string $value): string
    {
        $value = trim($value);
        if (preg_match('/^(?:[0-9]{4}|[0-9]{5}-?[0-9]{3})$/D', $value) !== 1) {
            throw new ApiException(422, 'INVALID_POSTAL_CODE', 'Informe um código postal de 4 dígitos ou um CEP de 8 dígitos.');
        }
        return str_replace('-', '', $value);
    }
}
