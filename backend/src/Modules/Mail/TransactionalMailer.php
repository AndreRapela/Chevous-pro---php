<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Mail;

use ChezVoust\Core\HttpClient;

final class TransactionalMailer
{
    private const COPY = [
        'en' => [
            'email.verify' => ['Confirm your email', 'Confirm your email address to activate your account features.', 'Confirm email'],
            'email.change' => ['Confirm your new email', 'Confirm this address to update the email on your ChezVoust Pro account.', 'Confirm new email'],
            'email.code' => 'Enter this six-digit code on the confirmation page. It is valid for 15 minutes. You can also use the link below.',
            'email.password_reset' => ['Reset your password', 'We received a request to reset your password.', 'Reset password'],
            'ignore' => 'If you did not request this, you can ignore this email.',
        ],
        'fr' => [
            'email.verify' => ['Confirmez votre adresse e-mail', 'Confirmez votre adresse e-mail pour activer les fonctionnalités de votre compte.', 'Confirmer mon adresse'],
            'email.change' => ['Confirmez votre nouvelle adresse e-mail', 'Confirmez cette adresse pour modifier l’adresse e-mail de votre compte ChezVoust Pro.', 'Confirmer ma nouvelle adresse'],
            'email.code' => 'Saisissez ce code à six chiffres sur la page de confirmation. Il est valable 15 minutes. Vous pouvez aussi utiliser le lien ci-dessous.',
            'email.password_reset' => ['Réinitialisez votre mot de passe', 'Nous avons reçu une demande de réinitialisation de votre mot de passe.', 'Réinitialiser mon mot de passe'],
            'ignore' => 'Si vous n’avez pas fait cette demande, vous pouvez ignorer cet e-mail.',
        ],
        'pt' => [
            'email.verify' => ['Confirme seu e-mail', 'Confirme seu endereço de e-mail para ativar as ações da sua conta.', 'Confirmar e-mail'],
            'email.change' => ['Confirme seu novo e-mail', 'Confirme este endereço para trocar o e-mail da sua conta ChezVoust Pro.', 'Confirmar novo e-mail'],
            'email.code' => 'Digite este código de seis dígitos na página de confirmação. Ele vale por 15 minutos. Você também pode usar o link abaixo.',
            'email.password_reset' => ['Redefina sua senha', 'Recebemos um pedido para redefinir sua senha.', 'Redefinir senha'],
            'ignore' => 'Se você não solicitou esta ação, ignore este e-mail.',
        ],
    ];

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
        $path = match ($eventType) {
            'email.verify' => '/verificar-email',
            'email.change' => '/verificar-email?alteracao=1',
            'email.password_reset' => '/redefinir-senha',
            default => throw new \RuntimeException('Tipo de e-mail não suportado.'),
        };
        $locale = strtolower(str_replace('_', '-', (string) ($payload['locale'] ?? $this->config['locale'] ?? 'en')));
        $language = explode('-', $locale, 2)[0];
        $language = isset(self::COPY[$language]) ? $language : 'en';
        [$subject, $intro, $action] = self::COPY[$language][$eventType];
        $subject .= ' | ChezVoust Pro';
        $url = rtrim((string) $this->config['url'], '/') . $path . '#token=' . rawurlencode($token);
        $code = (string) ($payload['code'] ?? '');
        $codeHtml = in_array($eventType, ['email.verify', 'email.change'], true) && preg_match('/^[0-9]{6}$/D', $code) === 1
            ? '<p>' . htmlspecialchars(self::COPY[$language]['email.code'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
                . '<p style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#07543f">' . $code . '</p>'
            : '';
        $logo = $this->logoAttachment();
        $logoHtml = $logo === null ? '' : '<img src="cid:' . $logo['content_id']
            . '" alt="Chez vous pro" width="132" height="83" style="display:block;border:0;margin:0 0 20px">';
        $html = '<!doctype html><html lang="' . $language . '"><head><meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1"></head>'
            . '<body style="margin:0;background-color:#ffffff">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr>'
            . '<td align="center" style="padding:24px 12px">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"'
            . ' style="max-width:640px;border:2px solid #006b4d;border-radius:14px">'
            . '<tr><td style="padding:24px;text-align:left;font-family:Arial,sans-serif;color:#17212b;line-height:1.5">'
            . $logoHtml . '<p>' . htmlspecialchars($intro, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
            . $codeHtml
            . '<p><a href="' . htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '" style="display:inline-block;padding:12px 18px;background:#0c7a5b;color:#fff;text-decoration:none;border-radius:8px">'
            . htmlspecialchars($action, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</a></p><p style="margin-bottom:0">'
            . htmlspecialchars(self::COPY[$language]['ignore'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '</p></td></tr></table></td></tr></table></body></html>';
        $driver = $this->config['mail']['driver'];
        if ($driver === 'php-mail' || $driver === 'smtp') {
            [$headers, $body] = $this->mimeParts($html, $logo);
            $subject = mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n", 9);
            if ($driver === 'smtp') {
                $this->sendSmtp($email, $subject, $headers, $body);
            } elseif (!@mail($email, $subject, $body, $headers)) {
                throw new \RuntimeException('O servidor de e-mail da hospedagem recusou a entrega.');
            }
            return;
        }

        $message = [
            'from' => $this->config['mail']['from'], 'to' => [$email], 'subject' => $subject, 'html' => $html,
        ];
        if ($logo !== null) {
            $message['attachments'] = [$logo];
        }
        $response = $this->http->postJson('https://api.resend.com/emails', $message, ['Authorization: Bearer ' . $this->config['mail']['resend_api_key']]);
        if ($response['status'] < 200 || $response['status'] >= 300) {
            throw new \RuntimeException('O provedor de e-mail recusou a entrega (HTTP ' . $response['status'] . ').');
        }
    }

    private function logoAttachment(): ?array
    {
        $png = @file_get_contents(__DIR__ . '/assets/pro-logo.png');
        if ($png === false) {
            return null;
        }
        return [
            'filename' => 'pro-logo.png',
            'content_type' => 'image/png',
            'content_id' => bin2hex(random_bytes(16)) . '.logo@chezvouspro.com',
            'content' => base64_encode($png),
        ];
    }

    private function mimeParts(string $html, ?array $logo): array
    {
        $headers = [
            'From' => 'ChezVoust Pro <' . $this->config['mail']['from'] . '>',
            'MIME-Version' => '1.0',
        ];
        $body = quoted_printable_encode($html);
        if ($logo === null) {
            $headers['Content-Type'] = 'text/html; charset=UTF-8';
            $headers['Content-Transfer-Encoding'] = 'quoted-printable';
        } else {
            $boundary = 'chezvoust-' . bin2hex(random_bytes(12));
            $headers['Content-Type'] = 'multipart/related; type="text/html"; boundary="' . $boundary . '"';
            $body = implode("\r\n", [
                '--' . $boundary,
                'Content-Type: text/html; charset=UTF-8',
                'Content-Transfer-Encoding: quoted-printable',
                '',
                $body,
                '--' . $boundary,
                'Content-Type: image/png; name="' . $logo['filename'] . '"',
                'Content-Transfer-Encoding: base64',
                'Content-ID: <' . $logo['content_id'] . '>',
                'Content-Disposition: inline; filename="' . $logo['filename'] . '"',
                '',
                rtrim(chunk_split($logo['content']), "\r\n"),
                '--' . $boundary . '--',
                '',
            ]);
        }
        return [$headers, $body];
    }

    private function sendSmtp(string $email, string $subject, array $headers, string $body): void
    {
        $smtp = $this->config['mail']['smtp'];
        $from = $this->config['mail']['from'];
        $domain = substr(strrchr($from, '@'), 1);
        $headers['Date'] = gmdate('D, d M Y H:i:s +0000');
        $headers['Message-ID'] = '<' . bin2hex(random_bytes(16)) . '@' . $domain . '>';
        $headers['To'] = '<' . $email . '>';
        $headers['Subject'] = $subject;
        $message = '';
        foreach ($headers as $name => $value) {
            $message .= $name . ': ' . $value . "\r\n";
        }
        $message .= "\r\n" . rtrim($body, "\r\n") . "\r\n";
        $offset = 0;

        $connection = curl_init('smtps://' . $smtp['host'] . ':' . $smtp['port']);
        if ($connection === false || !curl_setopt_array($connection, [
            CURLOPT_USERNAME => $smtp['username'],
            CURLOPT_PASSWORD => $smtp['password'],
            CURLOPT_MAIL_FROM => '<' . $from . '>',
            CURLOPT_MAIL_RCPT => ['<' . $email . '>'],
            CURLOPT_UPLOAD => true,
            CURLOPT_INFILESIZE => strlen($message),
            CURLOPT_READFUNCTION => static function ($connection, $stream, int $length) use ($message, &$offset): string {
                $chunk = substr($message, $offset, $length);
                $offset += strlen($chunk);
                return $chunk;
            },
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ])) {
            throw new \RuntimeException('Falha ao configurar a conexão SMTP.');
        }
        if (curl_exec($connection) === false) {
            throw new \RuntimeException(sprintf(
                'Falha no transporte SMTP (cURL %d, SMTP %d).',
                curl_errno($connection),
                curl_getinfo($connection, CURLINFO_RESPONSE_CODE)
            ));
        }
    }
}
