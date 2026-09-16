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
        $currency = strtoupper((string) ($input['currency'] ?? $this->config['currency'] ?? 'BRL'));
        $rates = is_array($this->config['currency_rates'] ?? null) ? $this->config['currency_rates'] : ['BRL' => 1.0];
        if (!in_array($currency, ['BRL', 'EUR', 'USD'], true) || !isset($rates[$currency]) || !is_numeric($rates[$currency]) || (float) $rates[$currency] <= 0) {
            throw new ApiException(422, 'UNSUPPORTED_CURRENCY', 'The selected currency is not supported.');
        }
        $exchangeRate = (float) $rates[$currency];
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
        $unitPrice = (int) round((int) ($service['professional_price'] ?? $service['price_cents']) * $exchangeRate);

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
                $addonUnitPrice = (int) round((int) $addon['price_cents'] * $exchangeRate);
                $addonTotal = match ($addon['pricing_type']) {
                    'hourly' => (int) round($addonUnitPrice * ($duration / 60)),
                    'quantity' => (int) round($addonUnitPrice * $quantity),
                    default => $addonUnitPrice,
                };
                $addonsCents += $addonTotal;
                $items[] = [
                    'type' => 'addon', 'referenceId' => (int) $addon['id'], 'name' => $addon['name'],
                    'quantity' => $addon['pricing_type'] === 'quantity' ? $quantity : 1,
                    'unitPriceCents' => $addonUnitPrice, 'totalCents' => $addonTotal,
                ];
            }
        }

        // A plataforma não processa pagamentos. O valor exibido é apenas uma
        // referência inicial, sem taxa ou comissão da plataforma.
        $subtotal = $baseCents + $addonsCents;
        $discount = 0;
        $serviceFee = 0;
        $total = $subtotal;

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
            'currency' => $currency,
        ];
    }
}
