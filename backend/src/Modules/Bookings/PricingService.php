<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Bookings;

use ChezVoust\Core\ApiException;
use PDO;

final class PricingService
{
    public function __construct(
        private readonly PDO $db,
        private readonly array $config
    ) {
    }

    public function quote(array $input, ?int $professionalId = null): array
    {
        $statement = $this->db->prepare(
            'SELECT s.id, s.public_id, s.category_id, s.name, s.pricing_type, s.price_cents,
                    s.default_duration_minutes, s.minimum_quantity, s.maximum_quantity,
                    ps.price_cents AS professional_price
             FROM services s
             INNER JOIN service_categories c ON c.id = s.category_id AND c.active = 1
             LEFT JOIN professional_services ps ON ps.service_id = s.id AND ps.professional_id = :professional_id AND ps.active = 1
             WHERE s.public_id = :service_id AND s.active = 1 LIMIT 1'
        );
        $statement->execute([
            'professional_id' => $professionalId ?? 0,
            'service_id' => $input['serviceId'],
        ]);
        $service = $statement->fetch();
        if (!$service) {
            throw new ApiException(404, 'SERVICE_NOT_FOUND', 'Serviço não encontrado.');
        }
        if ($professionalId !== null && $service['professional_price'] === null) {
            $offering = $this->db->prepare(
                'SELECT 1 FROM professional_services WHERE professional_id = :professional_id AND service_id = :service_id AND active = 1'
            );
            $offering->execute(['professional_id' => $professionalId, 'service_id' => $service['id']]);
            if (!$offering->fetchColumn()) {
                throw new ApiException(422, 'SERVICE_NOT_OFFERED', 'O profissional selecionado não oferece este serviço.');
            }
        }

        $quantity = isset($input['quantity']) ? (float) $input['quantity'] : 1.0;
        $areaSqm = isset($input['areaSqm']) ? (float) $input['areaSqm'] : null;
        $duration = isset($input['durationMinutes'])
            ? (int) $input['durationMinutes']
            : (int) $service['default_duration_minutes'];
        $unitPrice = (int) ($service['professional_price'] ?? $service['price_cents']);

        $pricedQuantity = $service['pricing_type'] === 'area' ? ($areaSqm ?? 0.0) : $quantity;
        if ($pricedQuantity < (float) $service['minimum_quantity'] || $pricedQuantity > (float) $service['maximum_quantity']) {
            throw new ApiException(422, 'INVALID_QUANTITY', 'A quantidade está fora da faixa permitida para este serviço.');
        }
        if ($duration < 30 || $duration > 1440 || $duration % 30 !== 0) {
            throw new ApiException(422, 'INVALID_DURATION', 'A duração deve usar intervalos de 30 minutos, entre 30 minutos e 24 horas.');
        }

        $baseCents = match ($service['pricing_type']) {
            'hourly' => (int) round($unitPrice * ($duration / 60) * $quantity),
            'area' => $areaSqm !== null && $areaSqm > 0
                ? (int) round($unitPrice * $areaSqm)
                : throw new ApiException(422, 'AREA_REQUIRED', 'Informe a área em metros quadrados.'),
            default => (int) round($unitPrice * $quantity),
        };

        $items = [[
            'type' => 'service',
            'referenceId' => (int) $service['id'],
            'name' => $service['name'],
            'quantity' => $service['pricing_type'] === 'area' ? $areaSqm : $quantity,
            'unitPriceCents' => $unitPrice,
            'totalCents' => $baseCents,
        ]];
        $addonsCents = 0;
        $addonIds = array_values(array_unique(array_filter($input['addonIds'] ?? [], 'is_string')));
        if (count($addonIds) > 20) {
            throw new ApiException(422, 'TOO_MANY_ADDONS', 'Selecione no máximo 20 adicionais.');
        }
        if ($addonIds !== []) {
            $placeholders = implode(',', array_fill(0, count($addonIds), '?'));
            $addons = $this->db->prepare(
                "SELECT id, public_id, name, price_cents, pricing_type FROM service_addons
                 WHERE service_id = ? AND public_id IN ({$placeholders}) AND active = 1"
            );
            $addons->execute(array_merge([(int) $service['id']], $addonIds));
            $rows = $addons->fetchAll();
            if (count($rows) !== count($addonIds)) {
                throw new ApiException(422, 'INVALID_ADDON', 'Um ou mais adicionais não pertencem ao serviço.');
            }
            foreach ($rows as $addon) {
                $addonTotal = match ($addon['pricing_type']) {
                    'hourly' => (int) round((int) $addon['price_cents'] * ($duration / 60)),
                    'quantity' => (int) round((int) $addon['price_cents'] * $quantity),
                    default => (int) $addon['price_cents'],
                };
                $addonsCents += $addonTotal;
                $items[] = [
                    'type' => 'addon', 'referenceId' => (int) $addon['id'], 'name' => $addon['name'],
                    'quantity' => $addon['pricing_type'] === 'quantity' ? $quantity : 1,
                    'unitPriceCents' => (int) $addon['price_cents'], 'totalCents' => $addonTotal,
                ];
            }
        }

        $subtotal = $baseCents + $addonsCents;
        $coupon = $this->resolveCoupon($input['couponCode'] ?? null, (int) $service['id'], (int) $service['category_id'], $subtotal);
        $discount = $coupon['discountCents'] ?? 0;
        $feePercent = $this->numericSetting('service_fee_percent', 12.0);
        $commissionPercent = $this->numericSetting('professional_commission_percent', 15.0);
        $serviceFee = (int) round($subtotal * $feePercent / 100);
        $professionalAmount = max(0, (int) round($subtotal * (100 - $commissionPercent) / 100));
        $total = max(0, $subtotal + $serviceFee - $discount);

        return [
            'serviceInternalId' => (int) $service['id'],
            'serviceId' => $service['public_id'],
            'serviceName' => $service['name'],
            'pricingType' => $service['pricing_type'],
            'durationMinutes' => $duration,
            'quantity' => $quantity,
            'areaSqm' => $areaSqm,
            'items' => $items,
            'subtotalCents' => $subtotal,
            'discountCents' => $discount,
            'serviceFeeCents' => $serviceFee,
            'totalCents' => $total,
            'professionalAmountCents' => $professionalAmount,
            'currency' => $this->config['currency'],
            'couponInternalId' => $coupon['id'] ?? null,
            'couponCode' => $coupon['code'] ?? null,
        ];
    }

    private function resolveCoupon(mixed $code, int $serviceId, int $categoryId, int $subtotal): ?array
    {
        if (!is_string($code) || trim($code) === '') {
            return null;
        }
        $statement = $this->db->prepare(
            'SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_discount_cents, c.minimum_order_cents,
                    c.usage_limit, c.used_count
             FROM coupons c
             WHERE c.code = :code AND c.active = 1
               AND (c.starts_at IS NULL OR c.starts_at <= UTC_TIMESTAMP())
               AND (c.ends_at IS NULL OR c.ends_at >= UTC_TIMESTAMP())
               AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
               AND (NOT EXISTS (SELECT 1 FROM coupon_services cs WHERE cs.coupon_id = c.id)
                    OR EXISTS (SELECT 1 FROM coupon_services cs WHERE cs.coupon_id = c.id AND (cs.service_id = :service_id OR cs.category_id = :category_id)))
             LIMIT 1'
        );
        $statement->execute(['code' => strtoupper(trim($code)), 'service_id' => $serviceId, 'category_id' => $categoryId]);
        $coupon = $statement->fetch();
        if (!$coupon) {
            throw new ApiException(422, 'INVALID_COUPON', 'Cupom inválido, expirado ou esgotado.');
        }
        if ($subtotal < (int) $coupon['minimum_order_cents']) {
            throw new ApiException(422, 'COUPON_MINIMUM_NOT_REACHED', 'O valor mínimo deste cupom ainda não foi atingido.');
        }
        $discount = $coupon['discount_type'] === 'percent'
            ? (int) round($subtotal * (float) $coupon['discount_value'] / 100)
            : (int) $coupon['discount_value'];
        if ($coupon['max_discount_cents'] !== null) {
            $discount = min($discount, (int) $coupon['max_discount_cents']);
        }
        return ['id' => (int) $coupon['id'], 'code' => $coupon['code'], 'discountCents' => min($subtotal, $discount)];
    }

    private function numericSetting(string $key, float $fallback): float
    {
        $statement = $this->db->prepare('SELECT setting_value FROM app_settings WHERE setting_key = :key LIMIT 1');
        $statement->execute(['key' => $key]);
        $value = $statement->fetchColumn();
        if ($value === false) {
            return $fallback;
        }
        $decoded = json_decode((string) $value, true);
        return is_numeric($decoded) ? (float) $decoded : (is_numeric($value) ? (float) $value : $fallback);
    }
}
