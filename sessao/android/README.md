# Sessão para Android

Este projeto empacota a PWA hospedada em `https://sess-80b2c.web.app` como uma
Trusted Web Activity (TWA). Assim, o aplicativo abre em tela cheia usando o
Chrome do aparelho e mantém o fluxo de login do Google compatível.

## Identidade do aplicativo

- Pacote: `com.natanaelneves.sessao`
- Versão: `0.3.0` (`versionCode` 3)
- Android mínimo: 5.0 (API 21)
- Android alvo: API 36

## Compilação de teste

O APK de desenvolvimento usa a chave de depuração local do Android. Ele serve
para instalação e testes, mas não deve ser enviado à Play Store.

Antes da publicação, gere uma chave definitiva e mantenha-a fora do repositório.
A assinatura gerenciada pelo Google Play também precisa ser adicionada ao arquivo
`public/.well-known/assetlinks.json`; não remova a assinatura de depuração enquanto
esta versão beta ainda estiver sendo testada.

O conteúdo exibido pelo APK vem do site hospedado. Portanto, publique a versão web
antes de distribuir um novo APK ou AAB.
