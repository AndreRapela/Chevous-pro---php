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
- configure SMTP, armazenamento privado, gateway de pagamento e verificação de identidade reais;
- faça varredura de dependências, análise estática e testes de intrusão;
- defina retenção, anonimização e rotina de atendimento aos direitos da LGPD;
- habilite backups criptografados, restauração testada e observabilidade.

O fluxo de pagamento incluído no projeto é um simulador de desenvolvimento. Nenhum
dado completo de cartão deve transitar ou ser armazenado pela aplicação.
