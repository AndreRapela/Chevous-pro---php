# Operação e publicação

## Fluxo de entrega

Cada tarefa concluída deve ter validação, commit, push e deploy. A entrega só está
publicada quando a revisão enviada ao Git corresponde à versão verificada no site.
Falhas de acesso, configuração ou validação devem ser registradas como pendências,
sem declarar a publicação concluída.

1. Revisar o diff e conferir arquivos novos, segredos, dados pessoais e alterações de
   esquema. Não incluir arquivos locais por meio de `git add --force`.
2. Executar os gates de qualidade de `tests/README.md` e gerar o build do ambiente
   de destino. Build de demonstração não substitui a validação da aplicação integrada.
3. Criar o commit e enviar o projeto completo ao repositório PHP. Atualizar também
   o repositório Angular com a árvore de `frontend`, preservando seu histórico.
4. Confirmar o backup restaurável, as configurações do servidor e o plano de rollback.
   Enviar somente os artefatos necessários, por um canal de transferência seguro.
5. Aplicar apenas migrações revisadas e compatíveis com os dados existentes. Remoção
   de tabelas, colunas ou registros exige backup e aprovação explícita.
6. Verificar HTTPS, arquivos estáticos e rotas principais depois do deploy. Em produção
   integrada, verificar também `/api/v1/health`, banco, worker e uma reserva de teste
   controlada. Registrar os hashes Git, o ambiente e o resultado da verificação.

Push comum não deve substituir histórico remoto divergente. Reescrita de histórico
exige autorização específica e `--force-with-lease` com a revisão remota esperada.

### Arquivos locais e troca de computador

O Git deve conter código, testes, migrações, arquivos de configuração de exemplo e
documentação. Não enviar ao repositório nem à pasta pública da hospedagem:

- `.env` e suas variantes com credenciais reais, chaves privadas e perfis de acesso;
- dumps do banco, backups, arquivos privados enviados pelos usuários e logs;
- contas e registros do banco local ou dos testes de integração;
- `node_modules`, caches, relatórios de teste e metadados `.git`;
- cópias de recuperação do histórico e arquivos temporários da estação de trabalho.

Na troca de computador, transferir separadamente configurações e dados necessários
por um canal privado e criptografado, com acesso restrito. Confirmar a restauração
antes de descartar a máquina anterior. O push do código não preserva volumes Docker,
uploads privados, credenciais locais ou backups fora do repositório.

### Demonstração e produção integrada

A demonstração usa dados fictícios no navegador e não comprova persistência no banco,
entrega de e-mails, reservas reais ou cobrança. Sua publicação depende de autorização
e deve ser registrada como demonstração. Não misturar o build mock com os segredos ou
o banco de produção.

Produção integrada exige API e banco reais, SSR, worker, HTTPS e configuração segura.
Não publicar um build que dependa da API quando ela não responde no endereço esperado.
O checkout atual é apenas frontend; pagamento real não está implementado.

As migrações `202609110002_remove_payment_feature.sql` e
`202609120001_remove_coupon_feature.sql` removem estruturas de pagamentos e cupons.
Não executá-las em um banco existente sem conferir o conteúdo afetado, o backup e a
aprovação para a remoção.

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
