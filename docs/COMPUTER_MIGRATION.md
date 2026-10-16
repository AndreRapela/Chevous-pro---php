# Troca de computador

## Recuperar o projeto completo

O repositório PHP contém a aplicação completa: frontend, backend, banco, testes e
documentação. O repositório Angular é uma exportação da pasta `frontend`.

A revisão validada em 15/10/2026 está na branch
`feature/validated-release-20261015`. As branches `main` e a publicação existente
foram preservadas, sem reescrita do histórico remoto.

```powershell
git clone --branch feature/validated-release-20261015 https://github.com/AndreRapela/Chevous-pro---php.git chevoust-pro
Set-Location chevoust-pro
git remote rename origin php
git remote add angular https://github.com/AndreRapela/chevous-pro---angular.git
git status
```

Instale Git, Node.js 22 ou 24 e Docker com Compose v2. Na pasta `frontend`, execute
`npm ci` e `npm run check`. Os comandos de backend e integração estão em
`tests/README.md`.

Para a interface com dados fictícios, execute `npm run start:mock` na pasta
`frontend`. Para o ambiente integrado, siga o Compose local descrito no `README.md`.

## O que não está no Git

- Configurações `.env`, senhas, chaves, perfis de hospedagem e autenticação Git.
- Conteúdo dos volumes Docker, uploads privados e dados salvos no navegador.
- Backups, logs e cópias de recuperação do histórico.
- Dependências instaladas e builds, que devem ser gerados novamente.

Transfira somente os itens necessários por um canal privado e criptografado. Para
um ambiente local novo, copie `.env.example` para `.env`; não reutilize os segredos
de demonstração em produção. Não publique dumps ou arquivos de acesso no Git nem
na pasta pública da hospedagem.

Antes de apagar o computador antigo, confirme o clone, a instalação, o funcionamento
local e a restauração dos dados que precisar preservar. A cópia do código não
substitui o backup do banco nem do armazenamento privado.

O fluxo de commit, push, deploy, backup e revisão de migrações está em
`docs/OPERATIONS.md`.

As imagens da aplicação podem ser recuperadas do Docker Hub conforme
`docs/DOCKER_RELEASE.md`. Elas não incluem o banco local, credenciais ou uploads
privados.

## Estado local preservado em 16/10/2026

O pacote `andrerapela/chezvous-pro:state-20261016` preserva o banco completo da
aplicação e o volume `api_storage`, sem arquivos `.env`. Os uploads estavam vazios;
o banco continha seis contas demonstrativas, históricos de teste e sessões de acesso.
Nada foi importado para o site público. O volume MySQL original foi preservado.

O conteúdo está comprimido e cifrado com AES-256-GCM, incluindo verificação de
integridade. A chave aleatória `STATE_BACKUP_KEY` foi acrescentada somente ao `.env`
local. **Transfira esse `.env` por um canal privado antes de apagar o computador
antigo. Sem a chave, não há recuperação do pacote.** Não compartilhe esse arquivo
com imagens Docker, commits ou capturas de tela. Quem obtiver a chave e o pacote
poderá ler todo o banco, inclusive os hashes de senha e as sessões.

As imagens `api-38ea5628af88`, `web-38ea5628af88` e `ssr-38ea5628af88` continuam
sendo a revisão executável validada. Dependências, caches e relatórios são
reconstruídos; não são necessários para recuperar o estado da aplicação.

### Baixar e conferir

Depois do clone, com o `.env` privado na raiz, execute em PowerShell. Pare se
qualquer comando falhar; use um nome de container de download ainda inexistente.

```powershell
New-Item -ItemType Directory -Force .data/migration | Out-Null
docker pull andrerapela/chezvous-pro:state-20261016
docker create --name chezvous-state-download andrerapela/chezvous-pro:state-20261016 /not-executed
docker cp chezvous-state-download:/state.cvp .data/migration/state.cvp
docker rm chezvous-state-download
Get-FileHash .data/migration/state.cvp -Algorithm SHA256
node scripts/backup/state.mjs verify --env-file .env --input .data/migration/state.cvp
```

SHA-256 esperado do arquivo cifrado:
`bcf8f789d9b4a39310518dc3d1656077aba3965c51d31586a7b375faf9f42446`.

### Restaurar somente no computador novo

Node.js 22 ou mais recente, Docker em modo Linux e Compose 2.24.4 ou mais recente
são necessários. Não execute contra volumes existentes ou produção. O programa
recusa banco e armazenamento não vazios e não executa exclusões. Caso uma importação
falhe, preserve a origem e prepare novos volumes isolados antes de tentar novamente.

O overlay abaixo evita a carga automática de `schema.sql`, pois a restauração
precisa de um banco vazio. Não inicie API ou worker antes de terminar.

```powershell
docker compose -f compose.yaml -f compose.restore.yaml up -d --wait database
docker volume create --label com.docker.compose.project=chezvoust-pro --label com.docker.compose.volume=api_storage chezvoust-pro_api_storage
node scripts/backup/state.mjs restore --env-file .env --database-container chezvoust-pro-database-1 --storage-volume chezvoust-pro_api_storage --input .data/migration/state.cvp
```

Após a restauração, defina `AUTO_SEED=false` no `.env` e confira as migrações
registradas antes de iniciar os demais serviços. Use as imagens já publicadas:

```powershell
$env:IMAGE_TAG = '38ea5628af88'
docker compose -f compose.yaml -f compose.registry.yaml up -d --wait
```

Não acrescente `compose.restore.yaml` à inicialização normal. Para produção
integrada, siga o procedimento próprio de `docs/OPERATIONS.md`; este pacote é
uma transferência do ambiente local, não uma autorização para sobrepor dados reais.

### Gerar um novo pacote

Pare API, worker, web e SSR do projeto, mantendo apenas o banco ligado. Configure
uma `STATE_BACKUP_KEY` aleatória de 32 bytes em hexadecimal no `.env` privado.
Não use senha humana, não troque a chave de um pacote existente e não a informe
na linha de comando. Exporte para um caminho novo; o programa recusa sobrescrita:

```powershell
node scripts/backup/state.mjs export --env-file .env --database-container chezvoust-pro-database-1 --storage-volume chezvoust-pro_api_storage --output .data/migration/nova-revisao/public/state.cvp
node scripts/backup/state.mjs verify --env-file .env --input .data/migration/nova-revisao/public/state.cvp
```

O limite do pacote descomprimido é 128 MiB. O dump lógico contém apenas o banco
da aplicação, não contas de administração do MySQL. SQL e arquivos não cifrados
permanecem em memória, sem cópias temporárias no disco. Links simbólicos e arquivos
especiais do storage são recusados. Valide a restauração em volumes descartáveis,
compare os dados e só depois publique com uma tag inédita:

```powershell
docker build --platform linux/amd64 -f scripts/backup/Dockerfile -t andrerapela/chezvous-pro:state-<nova-data> .data/migration/nova-revisao/public
docker push andrerapela/chezvous-pro:state-<nova-data>
```

O contexto desse build deve conter **somente** `state.cvp`. O Dockerfile usa uma
imagem vazia e não copia o projeto, `.env` ou chave. O pacote público é persistente:
se sua chave for exposta, apagar a tag não garante remover cópias já baixadas.

Referências do formato: [cifra autenticada no Node.js](https://nodejs.org/api/crypto.html)
e [snapshot transacional do MySQL](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html#option_mysqldump_single-transaction).
