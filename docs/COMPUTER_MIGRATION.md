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
