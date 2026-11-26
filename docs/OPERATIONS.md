# Operação antes da venda

## Backup e restauração

- Faça uma cópia criptografada diária do MySQL e de todo o diretório `backend/storage/uploads`, que inclui mídias de campanhas e avatares. Guarde os dois arquivos da mesma execução juntos.
- Mantenha as cópias fora do host de produção, com acesso restrito e retenção definida pelo jurídico. Guarde as chaves de restauração e a configuração da aplicação, incluindo `OUTBOX_ENCRYPTION_KEY`, separadamente.
- Valide uma restauração isolada ao menos uma vez por mês. Registre a versão aplicada antes de cada deploy e confirme que `php bin/migrate.php` concluiu com sucesso.

### Backup no Docker Compose

O exemplo pressupõe o MySQL no serviço `database`, armazenamento no volume
`api_storage` e `AUTO_SEED=false`. Execute em Bash com o GnuPG instalado.
Defina `CVP_BACKUP_DIR` como um diretório protegido já existente e
`CVP_BACKUP_RECIPIENT` como a impressão digital de uma chave pública
confiável do operador de restauração. Use os arquivos Compose e o projeto da
instalação que será copiada. A API e o worker ficam parados durante a captura
para impedir alterações no banco e nos arquivos entre as duas cópias.
[Manual do mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html) · [Docker Compose run](https://docs.docker.com/reference/cli/docker/compose/run/)

```bash
(
  set -euo pipefail
  umask 077
  : "${CVP_BACKUP_DIR:?Informe o diretório protegido}"
  : "${CVP_BACKUP_RECIPIENT:?Informe a impressão digital da chave pública}"
  compose=(docker compose)
  test "$("${compose[@]}" exec -T api printenv AUTO_SEED)" = false
  backup_dir=$(mktemp -d "${CVP_BACKUP_DIR%/}/cvp-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")

  trap '"${compose[@]}" start api worker >&2' EXIT
  "${compose[@]}" stop api worker
  "${compose[@]}" exec -T database sh -ec '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces \
      --set-gtid-purged=OFF --routines --events --user="$MYSQL_USER" "$MYSQL_DATABASE"
  ' | gpg --batch --encrypt --recipient "$CVP_BACKUP_RECIPIENT" --output "$backup_dir/database.sql.gpg"
  "${compose[@]}" run --rm --no-deps -T --user 0 api \
    tar -czf - -C /var/www/html/storage uploads \
    | gpg --batch --encrypt --recipient "$CVP_BACKUP_RECIPIENT" --output "$backup_dir/uploads.tar.gz.gpg"
  (cd "$backup_dir" && sha256sum database.sql.gpg uploads.tar.gz.gpg > SHA256SUMS)
  printf '%s\n' "$backup_dir"
)
```

Confirme que a sonda `/api/v1/health` voltou a responder HTTP 200 e copie o
diretório completo para o destino de backup. Use somente conjuntos concluídos
com `SHA256SUMS`.

### Ensaio de restauração isolada

Defina `CVP_RESTORE_DIR` como o caminho absoluto do conjunto de backup
e disponibilize a chave privada correspondente ao GnuPG. Execute a partir da
versão do código registrada no backup. O exemplo cria um projeto com banco,
volume e portas próprios e desativa o seed e as integrações de pagamento e
e-mail real.

```bash
(
  set -euo pipefail
  : "${CVP_RESTORE_DIR:?Informe o caminho absoluto do backup}"
  (cd "$CVP_RESTORE_DIR" && sha256sum --check SHA256SUMS)
  export APP_ENV=local AUTO_SEED=false STORE_PAYMENT_MODE=disabled MAIL_DRIVER=log
  export MYSQL_PORT=0 API_PORT=0 WEB_PORT=0
  restore_project="cvp-restore-$(date +%s)-$RANDOM"
  compose=(docker compose --env-file .env.example -p "$restore_project")
  "${compose[@]}" up -d --wait database
  mysql_command='MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --binary-mode=1 --user="$MYSQL_USER" "$MYSQL_DATABASE"'
  gpg --decrypt "$CVP_RESTORE_DIR/database.sql.gpg" \
    | "${compose[@]}" exec -T database sh -ec "$mysql_command"
  printf "%s\n" "DELETE FROM app_settings WHERE setting_key = 'worker_heartbeat';" \
    | "${compose[@]}" exec -T database sh -ec "$mysql_command"
  gpg --decrypt "$CVP_RESTORE_DIR/uploads.tar.gz.gpg" \
    | "${compose[@]}" run --rm --no-deps -T --user 0 api \
      tar -xzf - -C /var/www/html/storage
  "${compose[@]}" up -d --wait api
  printf '%s\n' "$restore_project"
  "${compose[@]}" port api 80
)
```

No projeto de teste, confirme `/api/v1/health/live` e abra um avatar e
uma mídia local de campanha referenciados no banco. Compare os arquivos
restaurados com os originais e confira se o PHP pode lê-los. O worker
permanece parado durante o ensaio para preservar a fila restaurada.

### Hospedagem sem Compose

Exporte o banco pelo painel da hospedagem ou pelo cliente MySQL e copie
`backend/storage/uploads` por FTPS ou SFTP durante a mesma janela sem
gravações. Criptografe e guarde os dois artefatos juntos. Na restauração,
preserve os caminhos, nomes e permissões. Os avatares já gravados usam
caminhos absolutos no banco. Se a raiz do backend mudar, ajuste esses caminhos
para a nova raiz e valide a resposta de `/api/v1/avatars/{id}`.

## Fila de e-mails

Com `MAIL_DRIVER=php-mail`, o PHP tenta enviar o evento recém-criado ao
terminar a requisição. Requisições bem-sucedidas que passam pela API também
podem processar até dois eventos prontos por intervalo de 30 segundos. O
arquivo de controle fica em `backend/storage/cache` e deve ser gravável
pelo PHP. As tentativas respeitam o próximo horário registrado na fila e
descartam links expirados ou já usados antes do envio.
[Manual do PHP sobre a finalização de requisições FastCGI](https://www.php.net/manual/en/function.fastcgi-finish-request.php)

O worker processa a fila mesmo em períodos sem tráfego na API. Em instalações
que operam só com o PHP da hospedagem, a próxima requisição à API retoma as
tentativas pendentes. O usuário pode pedir outro link pela tela de entrada ou
ao abrir uma confirmação vencida.

## Observabilidade

- Monitore `/api/v1/health` para a operação completa. Ele retorna HTTP 200
  quando o banco responde e o worker concluiu um ciclo recente, ou HTTP 503
  quando o sinal do worker está ausente, vencido ou indica falha.
- `/health` verifica o Nginx e `/api/v1/health/live` verifica a API
  e o banco sem aguardar o worker. O Compose usa a segunda sonda para iniciar
  os serviços na ordem correta e verifica o worker separadamente.
- O intervalo máximo sem um ciclo bem-sucedido é de 180 segundos por padrão.
  Ajuste `WORKER_HEARTBEAT_MAX_AGE_SECONDS` de acordo com a frequência
  e o tempo esperado de execução do worker. Em instalações sem Compose, a
  sonda usa o mesmo sinal gravado por `php backend/bin/worker.php`.
- Centralize logs sem corpo de mensagens, tokens, senhas ou payloads da outbox.
- Configure alertas para falhas de saúde, erros recorrentes de entrega de
  e-mail ou Stripe, crescimento de `outbox_events`, erros 5xx, latência
  p95 e volume de consultas incrementais do chat.

## Privacidade e identidade

"Perfil aprovado" significa revisão operacional do cadastro, não verificação de identidade. KYC, retenção legal, exclusão definitiva e exportação de dados requerem definição jurídica, DPO responsável e fornecedor aprovado antes de afirmar conformidade LGPD.
