# Sessão nas lojas — Google Play e App Store

Guia de publicação do app Android/iOS. Situação em 28/10/2026. Nada foi publicado:
os arquivos abaixo foram gerados só nesta máquina.

## 1. Diagnóstico

**Arquitetura**

| Camada | O que é |
|---|---|
| Frontend | React 19 + Vite 8, SPA (`src/App.jsx`), CSS próprio, PWA (`vite-plugin-pwa`) |
| Build web | `npm run build` → `dist/` (Hosting serve `dist/` com rewrite para `index.html`) |
| Firebase | **Auth** (só Google), **Firestore** (cache offline persistente), **Hosting**. Sem Storage (fotos ficam no Firestore como data URL), sem Functions, sem FCM, sem Analytics |
| APIs externas | TMDB (filmes, chave `VITE_TMDB_*` no cliente), wsrv.nl (proxy de imagens para os cartões), JustWatch/IMDb (links) |
| Mobile | Capacitor 8: `capacitor-android/` (já existia) e `ios/` (novo). O build web vai **dentro** do app — não é uma WebView apontando para a URL |
| CI | GitHub Actions: lint + testes + build + deploy do Hosting a cada push na `main` |

**Estratégia:** manter o Capacitor. O app já é mobile-first e responsivo, já roda empacotado
no Android e o Firebase continua idêntico entre web e app. PWA sozinho não entra nas lojas;
reescrever em nativo não traz ganho que justifique o custo. O que faltava era adaptar
as partes que dependem do navegador e cumprir as regras das lojas (seção 2).

**Problemas encontrados (e o que foi feito)**

| Problema | Onde | Situação |
|---|---|---|
| `<a download>` não baixa nada no WebView (cartão do filme, retrospectiva, `.ics`) | `App.jsx` | Corrigido: folha de compartilhamento nativa |
| `navigator.share` não existe no WebView do Android (convite, cartões) | `App.jsx` | Corrigido: plugin Share |
| "Exportar memórias" usava `window.open` + `print()`, inexistentes no app | `exportToPdf` | Corrigido: no app gera o `.html` e abre a folha de compartilhamento |
| Convite mandava o link `https://localhost` (origem interna do app) | `InviteScreen` | Corrigido: usa `https://sess-80b2c.web.app` |
| Privacidade/Créditos abriam `window.open` relativo — saía do app sem volta | Configurações | Corrigido: navegador interno do sistema (Custom Tabs / Safari View) |
| Fotos do álbum abriam data URL em nova aba (navegava para fora do app) | álbum da sessão | Corrigido: no app abre a folha de compartilhamento da foto |
| **App Store 4.8**: login só com Google exige oferecer "Entrar com a Apple" | login | Implementado (só no iPhone); precisa de configuração sua (seção 5) |
| **App Store 5.1.1(v)**: excluir conta Apple exige revogar o token da Apple | exclusão | Implementado (`revokeAccessToken` após reautenticar) |
| `allowBackup="true"` copiava a sessão do Firebase para o backup do Google Drive | Android | Desligado |
| Sem configuração de assinatura de release | Android | Criada, com chave fora do repositório |
| Rodapé dizia "beta 0.3" | Configurações | Mostra a versão real (`package.json`) |
| Página de privacidade diz "fase beta" | `public/privacy.html` | **Pendente — decisão sua** (seção 5). Contato já incluído: natanaelnevesalves@gmail.com |
| Chaves do TMDB vão no bundle (`VITE_*`) | build | Aceitável (token de leitura, como já é na web); não há segredo de servidor no front |
| Config web do Firebase e `google-services.json` versionados | repo | Não são segredos (a segurança vem das regras); mantidos |
| Nenhuma credencial admin/service account no front | — | Verificado |

**Não existe no produto (nada a configurar):** notificações push remotas, câmera própria (a foto vem do
seletor de arquivos do sistema), geolocalização, compras, assinaturas, anúncios, rastreamento.

## 1b. Segunda etapa (28/10/2026): contas, textos e recursos do celular

**Corrigido**
- "juntos há 1 ano" confundia: casais liam como "1 ano usando o app". O casal tem duas datas, e o
  código misturava as duas: `since` é o início do relacionamento; `createdAt` é o dia em que o diário
  foi criado. Agora a Home mostra "1 ano e 7 meses de relacionamento"; a página do casal mostra
  "… de relacionamento · 597 dias de Sessão"; a conquista "1 ano usando o Sessão" conta a partir da
  criação do diário (antes era liberada no primeiro dia para quem informava um namoro de 1 ano).
  A pergunta na criação virou "Quando começou o relacionamento de vocês?". Lógica em `src/coupleDates.js` (testada).
- Contato de suporte: na política de privacidade e em Configurações › "Fale com a gente" (abre o e-mail).

**Login próprio (e-mail e senha)** — `src/emailAuth.js` + "Entrar com e-mail" na tela de login:
criar conta (nome, e-mail, senha de 8+ caracteres), entrar, "Esqueci minha senha" (link por e-mail,
sem revelar se o e-mail tem conta), e-mail de verificação enviado na criação (não bloqueia o uso),
mensagens em português. Excluir conta pede a senha de quem usa e-mail. Funciona igual na web e no app.
Opções de login agora: **Google** (web, Android, iOS), **Apple** (iPhone) e **e-mail** (todos).
> Precisa de você: Firebase Console → Authentication → Sign-in method → ative **E-mail/senha**.
> Sem isso o formulário mostra "Entrar com e-mail ainda não está disponível". Em *Templates*, revise
> o texto dos e-mails de redefinição de senha e verificação (o app já pede o idioma pt-BR).

**Recursos nativos que funcionam de verdade** (testados no emulador Android, exceto onde indicado)

| Recurso | O que faz | Android | iOS |
|---|---|---|---|
| Atalhos do ícone (toque longo) | Registrar sessão · Adicionar à lista a dois · Roleta | registrados e abrindo o link certo (testado) | `UIApplicationShortcutItems` + `SceneDelegate.swift` — **não compilado** |
| Links do app `com.natanaelneves.sessao://acao/...` | abrem a tela certa, inclusive com o app fechado (a ação espera o diário carregar) | testado a frio e com o app aberto | configurado, não testado |
| Lembrete da sessão de cinema | notificação local 2 h antes do horário marcado (sem horário: meio-dia); tocar abre o ingresso | entregue no emulador com o ícone da claquete | configurado, não testado |
| Lembretes de sexta | sexta 19h, "Sexta de sessão?", abre a Lista; o toggle saiu de "em breve" | agendamento testado | idem |
| Permissão de notificação | pedida só ao marcar a primeira sessão de cinema ou ligar o toggle; nunca na abertura | ok | ok |
| Háptica | sucesso/erro (todos os avisos do app) e o botão + | plugin respondeu no emulador | — |
| Convite por link | `…/?convite=CODIGO` preenche o código ao entrar (web e app) | testado na web | — |
| Atalhos do PWA | os mesmos três atalhos para quem instala o site no Android | no `manifest.webmanifest` | — |

Os lembretes usam **alarme inexato**: o plugin pedia alarme exato e abria a tela de ajustes
"Alarmes e lembretes" do Android; a permissão `SCHEDULE_EXACT_ALARM` foi removida do manifesto.

**Avaliados e não feitos (com motivo)**
- *Widgets e Live Activities / Dynamic Island*: o único caso real é a contagem da sessão de cinema
  no dia. Exige um alvo Widget Extension em Swift (iOS) e um App Widget em Kotlin (Android), com os
  dados compartilhados entre o app e o widget (App Group). Não dá para compilar nem testar o iOS aqui;
  fica como próxima etapa, depois da publicação.
- *Push remoto (FCM)*: avisar "sua pessoa registrou um filme" exigiria Cloud Functions (plano Blaze, pago).
  Os lembretes atuais são locais e não precisam disso.
- *App Links / Universal Links* (abrir `sess-80b2c.web.app/?convite=` direto no app): dependem do SHA-256
  da chave de assinatura do Play e do Team ID da Apple. Configure depois da primeira publicação.
- *Face ID/biometria*: não há fluxo sensível que justifique.
- *Tema claro*: a identidade aprovada ("A cabine do Lumi") é a sala escura de cinema; um tema claro
  é uma decisão de produto, não um ajuste.
- *Barra inferior, botão +, folhas, botão voltar, movimento reduzido, áreas seguras, alvos de toque
  ≥ 44px*: já existiam do redesign; foram mantidos.

## 2. O que foi alterado

- `src/nativeShare.js` (novo): compartilhar/salvar imagem e arquivo, abrir páginas do site, origem pública.
- `src/nativeAuth.js`: login com a Apple (iOS), reautenticação por provedor e revogação do token da Apple.
- `src/App.jsx`: usa as funções acima; botão "Continuar com a Apple" só no iPhone; rodapé com a versão.
- `capacitor.config.json`: provedor `apple.com`; traits do SPM para não embutir o SDK do Facebook no iOS.
- `ios/` (novo): projeto Xcode (Swift Package Manager, iOS 15+, só iPhone, retrato), `Info.plist` com
  textos de permissão de câmera/fotos, `ITSAppUsesNonExemptEncryption=false`, esquema de URL do Google
  (a preencher), `App.entitlements` com Sign in with Apple, ícone 1024 sem alfa e splash.
- `capacitor-android/app/build.gradle`: `signingConfigs.release` lido de `~/.sessao-signing/keystore.properties`;
  `versionCode 7`, `versionName 1.0.0`. `AndroidManifest.xml`: `allowBackup="false"`.
- `scripts/android-upload-key.ps1` (novo): gera a upload key com senha aleatória fora do repo.
- `scripts/store-assets.mjs` (novo) → `store/`: ícone 512 do Play, gráfico de recursos 1024×500, ícone 1024 da App Store.
- `package.json`: versão 1.0.0; scripts `android:bundle`, `ios:sync`, `store:assets`; plugins `@capacitor/ios`, `share`, `filesystem`, `browser`.
- `vite.config.js`: o dev server ignora as cópias do build em `ios/` e `capacitor-android/`.
- `public/privacy.html` e `public/delete-account.html`: incluem o login com a Apple e corrigem "armazenamento" (não há Storage).
- `.gitignore`: chaves (`*.jks`, `keystore.properties`), `.gradle-user/`, APK/AAB em `artifacts/`.

## 3. Android — gerar e enviar

Ambiente desta máquina: JDK = `jbr` do Android Studio, Gradle 9.3.1, SDK 36. Rode o Gradle pelo PowerShell.

```powershell
# 1) só na primeira vez: cria ~/.sessao-signing/sessao-upload.jks + keystore.properties
.\scripts\android-upload-key.ps1        # (já executado em 28/10/2026)

# 2) build web + sync + AAB assinado
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
npm run android:sync
cd capacitor-android; .\gradlew.bat bundleRelease
```

Saída: `capacitor-android/app/build/outputs/bundle/release/app-release.aab`.

**Faça backup agora** de `C:\Users\Opn_Natan\.sessao-signing\` (o `.jks` e o `.properties`) num
cofre de senhas ou drive cifrado. Ela é a *upload key*; no Play App Signing o Google guarda a
chave final e a upload key pode ser trocada pelo suporte se for perdida.

Impressões digitais da upload key (públicas):

- SHA-1 `9B:1C:B9:75:2A:70:67:E5:77:A9:01:12:51:30:8A:8C:4C:FD:9A:A6`
- SHA-256 `61:AE:55:E3:49:F6:EF:99:7A:6B:0E:A4:44:A6:B0:7A:40:A5:44:93:E9:DC:85:BC:F8:8E:D0:E3:76:02:B4:97`

**Login do Google no app de release** — o Google só aceita o login de apps cujo SHA-1 está no Firebase:

1. Firebase Console → Configurações do projeto → app Android `com.natanaelneves.sessao` → *Adicionar impressão digital*: o SHA-1 da upload key acima.
2. Depois do primeiro envio ao Play: Play Console → *Testar e lançar → Configuração → Integridade do app → Assinatura de apps* → copie o **SHA-1 da chave de assinatura do app** e adicione no Firebase também.
3. Baixe o `google-services.json` novo e substitua `capacitor-android/app/google-services.json`; gere o AAB de novo.

Sem o passo 2, o app baixado da loja abre mas o login do Google falha.

**Testes em aparelho** (antes de cada envio):

```powershell
cd capacitor-android; .\gradlew.bat assembleRelease
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\release\app-release.apk
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat -s Capacitor:* chromium:* AndroidRuntime:E
```

Roteiro: login Google → criar diário → copiar/enviar convite (o link deve ser `sess-80b2c.web.app`) →
registrar filme com foto (galeria e câmera) → gerar cartão → "Compartilhar" e "Salvar" →
retrospectiva → "Adicionar ao calendário" (deve oferecer a agenda) → Configurações → Exportar,
Privacidade, Créditos → modo avião (o diário continua visível; ao voltar a rede sincroniza) →
botão voltar do sistema fecha modais → sair → excluir conta.
Tamanhos: um celular pequeno (≈360 dp), um grande (≈412 dp) e um tablet ou o emulador
`Medium_Tablet`; teste também fonte do sistema em 130%.

## 4. iOS — o que exige Mac

Não dá para compilar iOS no Windows. Opções: um Mac com **Xcode 26** (a App Store exige builds com
o SDK do iOS 26 desde abril de 2026), um Mac alugado na nuvem (MacinCloud, AWS EC2 Mac) ou CI
com macOS (Codemagic, GitHub Actions `macos-15`/`macos-26`, Xcode Cloud).

**Antes de abrir o Xcode (Firebase e Apple)**

1. Firebase Console → *Adicionar app* → iOS → bundle ID `com.natanaelneves.sessao` → baixe
   `GoogleService-Info.plist` e coloque em `ios/App/App/GoogleService-Info.plist` (o projeto já o referencia;
   sem ele o build falha de propósito).
2. Copie o valor de `REVERSED_CLIENT_ID` desse arquivo para `ios/App/App/Info.plist`, no lugar de
   `com.googleusercontent.apps.SUBSTITUIR-PELO-REVERSED-CLIENT-ID`.
3. Firebase Console → Authentication → *Sign-in method* → ative **Apple**. Para a revogação de token
   funcionar na exclusão de conta, preencha também *Team ID*, *Key ID* e a chave privada (`.p8`) de uma
   *Key* com "Sign in with Apple" criada em developer.apple.com → Certificates, IDs & Profiles → Keys.
   (Para login só pelo app iOS não é preciso Services ID.)

**No Mac**

```bash
git clone <repo> && cd sessao/sessao
npm ci
npm run ios:sync          # vite build + cap sync ios
npx cap open ios          # abre ios/App/App.xcodeproj
```

No Xcode, alvo **App** → *Signing & Capabilities*: marque *Automatically manage signing*, escolha seu
**Team**; confirme que aparece a capability **Sign in with Apple** (vem de `App.entitlements`). O Xcode
cria o App ID e os perfis sozinho. Versão: *General → Version* `1.0.0`, *Build* `1` (aumente o Build
a cada envio).

**Gerar e enviar**: escolha o destino *Any iOS Device (arm64)* → *Product → Archive* → *Distribute App →
App Store Connect → Upload*. Em seguida a build aparece no **TestFlight** (≈15 min de processamento).

**Teste no iPhone** (TestFlight ou cabo): login Google, **login Apple** (inclusive "ocultar meu e-mail"),
convite, foto pela câmera e pela galeria (os textos de permissão devem aparecer em português), cartão
→ "Salvar imagem", `.ics` → agenda, Exportar, Privacidade, sair, **excluir conta com Apple** e verificar
em Ajustes do iPhone → Apple ID → *Entrar com a Apple* que o Sessão sumiu da lista.

## 5. Pendências que dependem de você

1. **Contas**: Google Play Console (pessoal ou organização) e Apple Developer Program.
2. **Ative o login por e-mail/senha** no Firebase Console (seção 1b). Contato público: feito
   (natanaelnevesalves@gmail.com, vai ao ar com o site).
3. **"Beta"**: a página de privacidade diz "O Sessão está em fase beta". A Apple recusa apps
   apresentados como beta na loja (diretriz 2.2). Decida o texto e a versão pública.
4. **Revisar a política de privacidade** alterada (Apple + correção do Storage) — ela vai ao ar no próximo push na `main`.
5. **Identificadores**: o pacote `com.natanaelneves.sessao` vale para as duas lojas e **não muda depois de publicado**.
   Confirme se o TWA antigo (`sessao/android/`) chegou a ser publicado no Play com esse mesmo pacote.
6. **Firebase**: SHA-1 da upload key e da chave do Play; app iOS + `GoogleService-Info.plist`; provedor Apple (seções 3 e 4).
7. **Decisões provisórias** que tomei e você pode mudar: iOS só iPhone e só retrato (evita capturas de iPad);
   versão 1.0.0; nome "Sessão"; categoria sugerida *Entretenimento*.
8. **Capturas de tela** reais com dados do casal (ver checklists).

## 6. Custos (valores de referência — confirme nos sites)

| Item | Custo |
|---|---|
| Google Play Console | US$ 25, pagamento único |
| Apple Developer Program | US$ 99/ano (há isenção para ONGs/instituições de ensino qualificadas) |
| Mac para compilar iOS | um Mac com Xcode 26, **ou** aluguel (≈US$ 25–50/mês), **ou** CI macOS (Codemagic tem cota grátis mensal; GitHub Actions cobra minutos macOS em repositório privado) |
| Firebase | Plano Spark (grátis) continua suficiente: não foi adicionado nenhum serviço pago |
| TMDB | Grátis para uso não comercial; se o app passar a cobrar, verifique os termos comerciais |

## 7. Checklist — Google Play

- [ ] Conta no Play Console. **Conta pessoal criada após nov/2023**: antes da produção é obrigatório um
      *teste fechado* com **pelo menos 12 testadores por 14 dias seguidos**.
- [ ] Criar app: nome **Sessão**, idioma pt-BR, *App*, *Gratuito*.
- [ ] Enviar `app-release.aab` (versionCode 7) primeiro em *Teste interno*.
- [ ] SHA-1 do Play App Signing no Firebase + novo `google-services.json` (seção 3).
- [ ] Ficha: descrição curta (≤80 caracteres) e completa (≤4000) — rascunho abaixo; ícone `store/play-icon-512.png`;
      gráfico `store/play-feature-graphic-1024x500.png` (provisório); 2–8 capturas de celular (9:16, ≥1080 px no lado
      maior recomendado); capturas de tablet de 7" e 10" só se quiser destaque em tablets.
- [ ] Categoria: Entretenimento. Tags: filmes, casal, diário.
- [ ] Política de privacidade: `https://sess-80b2c.web.app/privacy.html`.
- [ ] Exclusão de conta (URL obrigatória): `https://sess-80b2c.web.app/delete-account.html`.
- [ ] *Acesso ao app*: crie uma conta de demonstração por e-mail (ex.: revisao.sessao@…) com um diário
      já preenchido e informe e-mail e senha. Explique que dá para usar sem parceiro ("Começar enquanto espero").
- [ ] Declarar a permissão de notificações (lembretes locais); não há alarme exato.
- [ ] *Anúncios*: não contém anúncios. *Compras no app*: nenhuma.
- [ ] Classificação de conteúdo (questionário IARC): sem violência/sexo/jogos de azar próprios; exibe capas e
      sinopses de filmes do TMDB; conteúdo do usuário é privado entre duas pessoas. Responda você.
- [ ] Público-alvo: 18+ ou 13+ (não direcionado a crianças) — **decisão sua**.
- [ ] Segurança dos dados (rascunho, confirmar): coleta **nome, e-mail, ID do usuário** (conta),
      **fotos** e **outro conteúdo gerado pelo usuário** (avaliações, listas) para *funcionalidade do app*;
      nada compartilhado com terceiros para publicidade; criptografado em trânsito; usuário pode pedir
      exclusão. Firebase/Google atua como prestador de serviço. Pesquisas de títulos vão ao TMDB sem dados pessoais.
- [ ] Testar o app da loja (link de teste interno) em aparelho real antes de promover.

**Rascunho da ficha (revise)** — curta: *O diário de cinema do casal: registrem filmes, notas e memórias a dois.*
Completa: o que o app faz hoje (registrar filmes e séries assistidos juntos, nota de cada um, lista a dois,
sessões de cinema com ingresso, álbum de fotos da noite, retrospectiva anual, Lumi como companheiro),
privacidade (só vocês dois leem o diário), crédito ao TMDB.

## 8. Checklist — App Store

- [ ] Apple Developer Program ativo; App ID criado pelo Xcode.
- [ ] App Store Connect → *Meus apps* → novo app: nome **Sessão** (se estiver ocupado, ex.: "Sessão — diário a dois"),
      idioma principal Português (Brasil), bundle `com.natanaelneves.sessao`, SKU `sessao-ios`.
- [ ] Firebase iOS + `GoogleService-Info.plist` + `REVERSED_CLIENT_ID` + provedor Apple com chave `.p8` (seção 4).
- [ ] Build enviada pelo Xcode e testada no TestFlight.
- [ ] Capturas de tela de iPhone 6,9" (1320×2868 ou 1290×2796) — obrigatórias; até 10.
- [ ] Ícone: vem do binário (`AppIcon` 1024, sem transparência — já gerado).
- [ ] Subtítulo (≤30), descrição, palavras-chave (≤100), URL de suporte (**obrigatória** — precisa do seu contato),
      URL da política de privacidade.
- [ ] Categoria: Entretenimento (secundária: Estilo de vida).
- [ ] Classificação etária (questionário novo de 2025): responda você — o app mostra informações de filmes de todas as faixas.
- [ ] *Privacidade do app*: mesmas categorias do Play (contato: nome/e-mail; identificadores: ID do usuário;
      conteúdo do usuário: fotos e outros), todas "vinculadas ao usuário", **sem rastreamento**.
- [ ] Conta de demonstração: a mesma conta por e-mail do Play (campos *Sign-in information*).
      Notas: "Também é possível entrar com Apple ou Google. Excluir conta: Configurações › Excluir conta.
      Atalhos: toque longo no ícone. Lembretes: marque uma sessão de cinema na Lista."
- [ ] Exportação de criptografia: já respondida no `Info.plist` (só HTTPS padrão).
- [ ] Remover "beta" do que o revisor vê (diretriz 2.2).
- [ ] Preço: grátis; sem compras no app.

**Riscos de revisão Apple**: a diretriz 4.2 (funcionalidade mínima) é a mais comum para apps em
Capacitor. O Sessão leva o build dentro do app, funciona offline, usa login nativo (Google e Apple),
folha de compartilhamento e navegador nativos — isso costuma bastar. Se vier rejeição 4.2, os próximos
passos naturais seriam notificações locais (lembrete de sexta) e háptica, não reescrever o app.

## 9. Próxima ação

0. Ative **E-mail/senha** no Firebase Authentication e teste criar conta, entrar e "Esqueci minha senha" no site.
1. Faça backup de `C:\Users\Opn_Natan\.sessao-signing\`.
2. Crie a conta do Play Console, crie o app e envie `app-release.aab` para *Teste interno*.
3. Pegue o SHA-1 do Play App Signing, cadastre no Firebase (junto com o da upload key), atualize o
   `google-services.json`, gere o AAB de novo (versionCode 8) e teste o login no app instalado pela loja.
