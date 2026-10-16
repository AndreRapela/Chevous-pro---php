# Imagens Docker

Repositório público: `andrerapela/chezvous-pro`.

| Tag | Serviço |
| --- | --- |
| `api-<revisão>` | API PHP e worker, com comandos separados no Compose |
| `web-<revisão>` | Nginx e arquivos estáticos do frontend de produção |
| `ssr-<revisão>` | Servidor Angular SSR de produção |

Cada revisão usa os 12 primeiros caracteres do commit Git. Não substituir tags
existentes nem publicar `latest` automaticamente. A plataforma desta publicação é
`linux/amd64`.

O servidor web usa `nginx:1.30.6-alpine`, versão estável com as correções listadas
nos [avisos de segurança do Nginx](https://nginx.org/en/security_advisories.html).

## Preparar e publicar

Execute os gates de `tests/README.md`, revise o diff, faça commit e push e confirme
que `git status --porcelain` está vazio antes do build. O login no Docker Hub deve
ter permissão de escrita no repositório de destino. Nunca colocar tokens em
argumentos, Dockerfiles ou arquivos versionados; use `docker login` e o cofre de
credenciais do Docker.

Na raiz do projeto, em PowerShell:

```powershell
$revision = (git rev-parse HEAD).Trim()
$tag = $revision.Substring(0, 12)
$repository = 'andrerapela/chezvous-pro'
docker build --pull --platform linux/amd64 --label "org.opencontainers.image.revision=$revision" --tag "${repository}:api-$tag" ./backend
docker build --pull --platform linux/amd64 --target web --build-arg BUILD_CONFIGURATION=production --label "org.opencontainers.image.revision=$revision" --tag "${repository}:web-$tag" ./frontend
docker build --pull --platform linux/amd64 --target ssr --build-arg BUILD_CONFIGURATION=production --label "org.opencontainers.image.revision=$revision" --tag "${repository}:ssr-$tag" ./frontend
```

Pare se qualquer comando falhar. Antes do envio, valide as imagens em Compose
isolado, sem volumes de produção. Confirme API, SSR, arquivos estáticos, agenda e
autenticação. Inspecione também ausência de `.env`, chaves privadas, dumps, senhas
de demonstração no frontend compilado e uploads privados.

Somente depois da validação:

```powershell
docker push "${repository}:api-$tag"
docker push "${repository}:web-$tag"
docker push "${repository}:ssr-$tag"
```

Confirme no registry as três tags e seus digests. Publicar no Docker Hub armazena
as imagens; não altera automaticamente o site hospedado.

## Usar as imagens no novo computador ou servidor

O clone do repositório completo continua necessário para Compose, configurações e
arquivos de esquema/migrações. A pasta `database` é montada somente para leitura;
não contém um backup dos dados reais. MySQL usa a imagem oficial e um volume
separado, sem dados embutidos nas imagens da aplicação.

Use Docker Compose 2.24.4 ou mais recente, com suporte a `!reset` e `!override`.
As regras de substituição estão na
[documentação do Compose](https://docs.docker.com/reference/compose-file/merge/).
Defina `IMAGE_TAG` com a revisão publicada e prepare um arquivo de ambiente real,
fora do repositório. Não use `.env.production.example` como configuração real.

Exemplo para conferir e baixar, sem iniciar serviços:

```powershell
$env:IMAGE_TAG = '<revisão publicada com 12 caracteres>'
docker compose -f compose.yaml -f compose.production.yaml -f compose.registry.yaml --env-file C:/config/chezvous-production.env config --quiet
docker compose -f compose.yaml -f compose.production.yaml -f compose.registry.yaml --env-file C:/config/chezvous-production.env pull
```

O overlay remove builds e binds de código local. API e worker executam a imagem
publicada; o armazenamento persistente permanece em volume separado.

Antes de iniciar a aplicação, siga `docs/OPERATIONS.md`: backup restaurável,
revisão e aprovação das migrações destrutivas, configuração real do banco e e-mail,
TLS externo e plano de rollback. O comando de inicialização da API executa as
migrações; portanto, não iniciar contra um banco existente sem essa revisão.

Não publicar `.env`, credenciais, dados de clientes, dumps, arquivos privados,
logs ou volumes Docker neste repositório público. Esses itens exigem transferência
privada e criptografada, não `docker push`.
