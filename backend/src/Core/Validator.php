<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use DateTimeImmutable;

final class Validator
{
    public static function validate(array $data, array $rules): array
    {
        $errors = [];
        $validated = [];

        foreach ($rules as $field => $definition) {
            $fieldRules = is_array($definition) ? $definition : explode('|', $definition);
            $exists = array_key_exists($field, $data);
            $nullable = in_array('nullable', $fieldRules, true);
            $numericBounds = in_array('integer', $fieldRules, true) || in_array('numeric', $fieldRules, true);

            if (!$exists) {
                if (in_array('required', $fieldRules, true)) {
                    $errors[$field][] = 'Este campo é obrigatório.';
                }
                continue;
            }

            $value = $data[$field];
            if ($value === null && $nullable) {
                $validated[$field] = null;
                continue;
            }

            foreach ($fieldRules as $rule) {
                if (in_array($rule, ['required', 'nullable', 'sometimes'], true)) {
                    continue;
                }

                [$name, $argument] = array_pad(explode(':', (string) $rule, 2), 2, null);
                $valid = match ($name) {
                    'string' => is_string($value),
                    'array' => is_array($value),
                    'boolean' => is_bool($value) || in_array($value, [0, 1, '0', '1'], true),
                    'integer' => filter_var($value, FILTER_VALIDATE_INT) !== false,
                    'numeric' => is_numeric($value),
                    'email' => is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) !== false,
                    'uuid' => is_string($value) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1,
                    'date' => self::validDate($value),
                    'min' => self::size($value, $numericBounds) >= (float) $argument,
                    'max' => self::size($value, $numericBounds) <= (float) $argument,
                    'in' => in_array((string) $value, explode(',', (string) $argument), true),
                    'regex' => is_string($value) && preg_match((string) $argument, $value) === 1,
                    default => true,
                };

                if (!$valid) {
                    $errors[$field][] = self::message($name, $argument);
                    break;
                }
            }

            if (!isset($errors[$field])) {
                $validated[$field] = $value;
            }
        }

        if ($errors !== []) {
            throw new ApiException(422, 'VALIDATION_ERROR', 'Revise os campos informados.', $errors);
        }

        return $validated;
    }

    private static function validDate(mixed $value): bool
    {
        if (!is_string($value)) {
            return false;
        }
        try {
            new DateTimeImmutable($value);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private static function size(mixed $value, bool $numericBounds): float
    {
        if ($numericBounds && is_numeric($value)) {
            return (float) $value;
        }
        if (is_string($value)) {
            return (float) mb_strlen($value);
        }
        if (is_array($value)) {
            return (float) count($value);
        }
        return is_numeric($value) ? (float) $value : -1;
    }

    private static function message(string $rule, ?string $argument): string
    {
        return match ($rule) {
            'string' => 'Informe um texto válido.',
            'array' => 'Informe uma lista válida.',
            'boolean' => 'Informe verdadeiro ou falso.',
            'integer' => 'Informe um número inteiro.',
            'numeric' => 'Informe um número válido.',
            'email' => 'Informe um e-mail válido.',
            'uuid' => 'Informe um identificador válido.',
            'date' => 'Informe uma data válida.',
            'min' => "O valor mínimo é {$argument}.",
            'max' => "O valor máximo é {$argument}.",
            'in' => 'Informe uma das opções permitidas.',
            default => 'Valor inválido.',
        };
    }
}
