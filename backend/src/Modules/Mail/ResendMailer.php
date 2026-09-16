<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Mail;

use ChezVoust\Core\HttpClient;

final class ResendMailer
{
    public function __construct(private readonly array $config, private readonly HttpClient $http)
    {
    }

    public function send(string $eventType, array $payload): void
    {
        $email = filter_var((string) ($payload['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        $token = (string) ($payload['token'] ?? '');
        if (!$email || preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
            throw new \RuntimeException('Evento de e-mail inválido.');
        }
        [$subject, $path, $intro, $action] = match ($eventType) {
            'email.verify' => ['Confirme seu e-mail | ChezVoust Pro', '/verificar-email', 'Confirme seu endereço de e-mail para ativar as ações da sua conta.', 'Confirmar e-mail'],
            'email.password_reset' => ['Redefina sua senha | ChezVoust Pro', '/redefinir-senha', 'Recebemos um pedido para redefinir sua senha.', 'Redefinir senha'],
            default => throw new \RuntimeException('Tipo de e-mail não suportado.'),
        };
        $url = rtrim((string) $this->config['url'], '/') . $path . '?token=' . rawurlencode($token);
        $html = '<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#17212b;line-height:1.5">'
            . '<h1>ChezVoust Pro</h1><p>' . htmlspecialchars($intro, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
            . '<p><a href="' . htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '" style="display:inline-block;padding:12px 18px;background:#0c7a5b;color:#fff;text-decoration:none;border-radius:8px">'
            . htmlspecialchars($action, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</a></p><p>Se você não solicitou esta ação, ignore este e-mail.</p></body></html>';
        $response = $this->http->postJson('https://api.resend.com/emails', [
            'from' => $this->config['mail']['from'], 'to' => [$email], 'subject' => $subject, 'html' => $html,
        ], ['Authorization: Bearer ' . $this->config['mail']['resend_api_key']]);
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new \RuntimeException('O provedor de e-mail recusou a entrega (HTTP ' . $response['status'] . ').');
        }
    }
}
