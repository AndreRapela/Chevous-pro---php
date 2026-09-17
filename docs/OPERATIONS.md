# Operação antes da venda

## Backup e restauração

- Execute backup criptografado do MySQL diariamente e valide uma restauração em ambiente isolado ao menos uma vez por mês.
- Mantenha o backup fora do host de produção, com retenção definida pelo jurídico e acesso mínimo necessário.
- Antes de cada deploy, registre a versão aplicada e confirme que `php bin/migrate.php` concluiu sem erro.

Exemplo de backup manual (nunca grave senha no histórico do terminal):

```bash
docker compose exec -T database mysqldump --single-transaction --routines --events chezvoust > backup.sql
```

## Observabilidade

- Monitore `/health` e `/api/v1/health`; o segundo deve confirmar acesso ao banco.
- Centralize logs sem corpo de mensagens, tokens, senhas ou payloads da outbox.
- Configure alerta para falhas repetidas do worker, crescimento de `outbox_events`, erros 5xx, latência p95 e taxa de conexões SSE ativas.

## Privacidade e identidade

"Perfil aprovado" significa revisão operacional do cadastro, não verificação de identidade. KYC, retenção legal, exclusão definitiva e exportação de dados requerem definição jurídica, DPO responsável e fornecedor aprovado antes de afirmar conformidade LGPD.
