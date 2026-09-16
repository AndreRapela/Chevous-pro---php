# Segurança

## Como reportar

Não abra detalhes de vulnerabilidades em uma issue pública. Envie o relato ao canal
privado definido pela organização responsável pela implantação, contendo impacto,
passos de reprodução e uma sugestão de correção quando possível.

## Configuração obrigatória antes de produção

- substitua todos os segredos de exemplo e use um gerenciador de segredos;
- sirva frontend e API exclusivamente por HTTPS;
- restrinja CORS ao domínio definitivo;
- desative `APP_DEBUG` e não exponha logs ou arquivos de ambiente;
- configure SMTP, armazenamento privado e verificação de identidade reais;
- faça varredura de dependências, análise estática e testes de intrusão;
- defina retenção, anonimização e rotina de atendimento aos direitos da LGPD;
- habilite backups criptografados, restauração testada e observabilidade.

A plataforma não processa pagamentos. O valor apresentado é uma referência para
negociação direta entre cliente e profissional; nenhum dado de cartão deve
transitar ou ser armazenado pela aplicação.

## Controles implementados

- senhas com Argon2id quando disponível e política de complexidade;
- access token curto somente em memória no navegador;
- refresh token rotativo em cookie `HttpOnly`, `SameSite=Strict` e `Secure` fora do local;
- sessões persistidas por dispositivo, com listagem e revogação pelo titular;
- troca e redefinição de senha revogando sessões antigas;
- RBAC, validação de propriedade, prepared statements, rate limit, idempotência e auditoria;
- CORS por lista permitida em todos os métodos e cabeçalhos de segurança no proxy;
- migrações de banco versionadas e serializadas por bloqueio.

Esses controles reduzem risco, mas não substituem pentest, revisão jurídica/LGPD,
gestão de segredos, MFA administrativo, monitoramento e resposta a incidentes antes de
uma publicação real.
