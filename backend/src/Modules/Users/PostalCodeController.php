<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Users;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\RateLimiter;
use PDO;

final class PostalCodeController extends Controller
{
    public function __construct(PDO $db, array $config, private readonly RateLimiter $rateLimiter)
    {
        parent::__construct($db, $config);
    }

    public function lookup(Request $request, array $params, ?array $auth): Response
    {
        $cep = preg_replace('/\D+/', '', (string) ($params['cep'] ?? ''));
        if (!is_string($cep) || !preg_match('/^\d{8}$/', $cep)) {
            throw new ApiException(422, 'INVALID_POSTAL_CODE', 'Informe um CEP com 8 dígitos.');
        }
        $this->rateLimiter->check('postal-code:' . $request->ip, 30, 60);
        $handle = curl_init('https://viacep.com.br/ws/' . $cep . '/json/');
        if ($handle === false) {
            throw new ApiException(503, 'POSTAL_CODE_UNAVAILABLE', 'A consulta de CEP está indisponível. Preencha o endereço manualmente.');
        }
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        if (!is_string($body) || $status !== 200) {
            throw new ApiException(503, 'POSTAL_CODE_UNAVAILABLE', 'A consulta de CEP está indisponível. Preencha o endereço manualmente.');
        }
        $address = json_decode($body, true);
        if (!is_array($address) || !empty($address['erro'])) {
            throw new ApiException(404, 'POSTAL_CODE_NOT_FOUND', 'CEP não encontrado. Confira os números ou preencha o endereço manualmente.');
        }
        $clean = static fn (string $key, int $limit): string => mb_substr(trim(strip_tags((string) ($address[$key] ?? ''))), 0, $limit);
        return Response::data([
            'postalCode' => substr($cep, 0, 5) . '-' . substr($cep, 5),
            'street' => $clean('logradouro', 180),
            'neighborhood' => $clean('bairro', 100),
            'city' => $clean('localidade', 100),
            'state' => strtoupper($clean('uf', 2)),
        ]);
    }
}
