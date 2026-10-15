<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Bookings;

use DateTimeImmutable;

/** The catalog and booking writer use the same working-hours decision. */
final class AvailabilityPolicy
{
    public static function covers(
        DateTimeImmutable $start,
        DateTimeImmutable $end,
        array $rules,
        array $exceptions,
    ): bool {
        $end = $end->setTimezone($start->getTimezone());
        $date = $start->format('Y-m-d');
        if ($end <= $start || $end->format('Y-m-d') !== $date) {
            return false;
        }

        $from = $start->format('H:i:s');
        $until = $end->format('H:i:s');
        $windows = [];
        foreach ($rules as $rule) {
            if ((int) $rule['weekday'] === (int) $start->format('w')) {
                $windows[] = $rule;
            }
        }
        foreach ($exceptions as $exception) {
            if ($exception['date'] !== $date) {
                continue;
            }
            $exceptionStart = $exception['startTime'] ?? null;
            $exceptionEnd = $exception['endTime'] ?? null;
            if ($exception['type'] === 'unavailable') {
                if (
                    $exceptionStart === null ||
                    $exceptionEnd === null ||
                    ($from < self::time($exceptionEnd) && $until > self::time($exceptionStart))
                ) {
                    return false;
                }
            } elseif (
                $exception['type'] === 'available' &&
                $exceptionStart !== null &&
                $exceptionEnd !== null
            ) {
                $windows[] = $exception;
            }
        }
        foreach ($windows as $window) {
            if (
                self::time($window['startTime']) <= $from &&
                self::time($window['endTime']) >= $until
            ) {
                return true;
            }
        }
        return false;
    }

    private static function time(string $value): string
    {
        return strlen($value) === 5 ? $value . ':00' : $value;
    }
}
