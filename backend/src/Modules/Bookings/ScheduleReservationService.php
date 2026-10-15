<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Bookings;

use ChezVoust\Core\ApiException;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class ScheduleReservationService
{
    private readonly DateTimeZone $timezone;

    public function __construct(private readonly PDO $db, string $timezone)
    {
        $this->timezone = new DateTimeZone($timezone);
    }

    /** Must run inside the booking transaction so the day lock covers the write. */
    public function reserve(
        int $professionalId,
        DateTimeImmutable $startUtc,
        DateTimeImmutable $endUtc,
        ?int $ignoreBookingId,
    ): void {
        if (!$this->db->inTransaction()) {
            throw new \LogicException('A reserva de agenda exige uma transação ativa.');
        }
        $startLocal = $startUtc->setTimezone($this->timezone);
        $date = $startLocal->format('Y-m-d');
        $this->db
            ->prepare(
                'INSERT INTO schedule_day_locks (professional_id, work_date, updated_at)
             VALUES (:professional_id, :work_date, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE updated_at = updated_at',
            )
            ->execute(['professional_id' => $professionalId, 'work_date' => $date]);
        $lock = $this->db->prepare(
            'SELECT professional_id FROM schedule_day_locks WHERE professional_id = :professional_id AND work_date = :work_date FOR UPDATE',
        );
        $lock->execute(['professional_id' => $professionalId, 'work_date' => $date]);

        $rules = $this->db->prepare(
            'SELECT weekday, start_time AS startTime, end_time AS endTime FROM availability_rules WHERE professional_id = :id AND active = 1',
        );
        $rules->execute(['id' => $professionalId]);
        $exceptions = $this->db->prepare(
            'SELECT exception_date AS date, type, start_time AS startTime, end_time AS endTime FROM availability_exceptions WHERE professional_id = :id AND exception_date = :date',
        );
        $exceptions->execute(['id' => $professionalId, 'date' => $date]);
        if (
            !AvailabilityPolicy::covers(
                $startLocal,
                $endUtc,
                $rules->fetchAll(),
                $exceptions->fetchAll(),
            )
        ) {
            throw new ApiException(
                422,
                'PROFESSIONAL_UNAVAILABLE',
                'O profissional não atende nesse horário.',
            );
        }

        $conflict = $this->db->prepare(
            "SELECT 1 FROM bookings
             WHERE professional_id = :professional_id AND status IN ('confirmed', 'provider_on_the_way', 'in_progress')
               AND scheduled_start < :ends_at AND scheduled_end > :starts_at AND id <> :ignore_id LIMIT 1",
        );
        $conflict->execute([
            'professional_id' => $professionalId,
            'starts_at' => $startUtc->format('Y-m-d H:i:s'),
            'ends_at' => $endUtc->format('Y-m-d H:i:s'),
            'ignore_id' => $ignoreBookingId ?? 0,
        ]);
        if ($conflict->fetchColumn()) {
            throw new ApiException(
                409,
                'SCHEDULE_CONFLICT',
                'Este horário acabou de ficar indisponível.',
            );
        }
        $holds = $this->db->prepare(
            "SELECT 1 FROM slot_reservations WHERE professional_id = :professional_id
               AND status = 'held' AND expires_at > UTC_TIMESTAMP()
               AND starts_at < :ends_at AND ends_at > :starts_at
               AND (booking_id IS NULL OR booking_id <> :ignore_id) LIMIT 1",
        );
        $holds->execute([
            'professional_id' => $professionalId,
            'starts_at' => $startUtc->format('Y-m-d H:i:s'),
            'ends_at' => $endUtc->format('Y-m-d H:i:s'),
            'ignore_id' => $ignoreBookingId ?? 0,
        ]);
        if ($holds->fetchColumn()) {
            throw new ApiException(
                409,
                'SCHEDULE_CONFLICT',
                'Este horário acabou de ficar indisponível.',
            );
        }
    }
}
