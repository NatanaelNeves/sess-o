<div align="center">

# Sessão 🎞️❤️

**O diário cinematográfico do casal.**

Um app para vocês dois registrarem o que assistem juntos, avaliarem cada sessão, montarem a watchlist a dois e relembrarem o ano em uma retrospectiva.

🔗 **[sess-80b2c.web.app](https://sess-80b2c.web.app/)**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?logo=pwa&logoColor=white)

</div>

---

## ✨ O que dá pra fazer

- 🎬 **Registrar sessões** — filmes e séries que vocês assistiram, com busca integrada ao TMDB (pôster, ano, gêneros, duração).
- ⭐ **Avaliar juntos** — cada um dá sua nota e crítica; o app calcula a **média do casal** e mostra um veredito fofo (de "Em perfeita sintonia" a "Polos opostos").
- ✏️ **Editar a qualquer momento** — mudou de ideia sobre a nota? É só editar.
- 🍿 **Watchlist a dois** — salvem o que querem ver, com prioridade e o motivo da indicação.
- 🎲 **Roleta** — não sabem o que ver? Deixem a sorte decidir.
- 📺 **Acompanhar séries** — status (assistindo / concluída / abandonada) e até qual temporada chegaram.
- 📅 **"Nesse dia"** — relembra o que vocês assistiram na mesma data em anos anteriores.
- ✦ **Retrospectiva** — um resumo do ano do casal (horas juntos, melhor avaliado, maior discordância e mais).
- 📤 **Compartilhar** — gera uma imagem bonita da sessão pros stories.
- 📱 **PWA instalável** — funciona offline (cache local) e instala como app no celular.

## 🎨 Identidade

Tema escuro cinematográfico — vermelho carmim, dourado nas notas, lilás na watchlist e a serifa *Cormorant Garamond* nos títulos. Pensado **mobile-first**, com bottom sheets, áreas de toque confortáveis e microinterações discretas.

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + Vite |
| Autenticação | Firebase Auth (Google) |
| Banco de dados | Cloud Firestore (tempo real + cache offline) |
| Dados de filmes | API do TMDB |
| Hospedagem | Firebase Hosting |
| CI/CD | GitHub Actions (deploy automático a cada push na `main`) |
| Imagens de share | html-to-image |

## 🚀 Rodando localmente

> O app fica em `sessao/`.

```bash
cd sessao
npm install
```

Crie um arquivo `sessao/.env` com as chaves do TMDB (a config web do Firebase já vem embutida como fallback):

```bash
VITE_TMDB_READ_TOKEN=seu_token_de_leitura_do_tmdb
VITE_TMDB_API_KEY=sua_api_key_do_tmdb
```

> As variáveis `VITE_FIREBASE_*` são opcionais localmente — se ausentes, o app usa a configuração pública embutida em `src/firebase.js`. Se quiser apontar pra outro projeto Firebase, defina-as no `.env`.

Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse `http://localhost:5173`.

## 📦 Build de produção

```bash
cd sessao
npm run build      # gera sessao/dist
npm run preview    # serve o build localmente
```

## ☁️ Deploy

O deploy é **automático**: todo push na branch `main` dispara o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que builda e publica no Firebase Hosting.

Secrets necessários no GitHub (Settings → Secrets and variables → Actions):

- `VITE_TMDB_READ_TOKEN`, `VITE_TMDB_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` — JSON da conta de serviço do Firebase
- (opcional) `VITE_FIREBASE_*`

Deploy manual, se precisar:

```bash
cd sessao
npm run build
npx firebase deploy --only hosting
```

## 📂 Estrutura

```
.
├─ .github/workflows/deploy.yml   # CI/CD → Firebase Hosting
└─ sessao/
   ├─ src/
   │  ├─ App.jsx        # app inteiro (componentes + lógica)
   │  ├─ App.css        # design system + camadas de polimento/mobile
   │  ├─ firebase.js    # init do Firebase (config embutida como fallback)
   │  ├─ theme.css      # tokens (cores, espaçamento, raios, easing)
   │  └─ typography.css # fontes
   ├─ firestore.rules   # regras de segurança do Firestore
   └─ firebase.json     # config de hosting
```

## 🔒 Privacidade

Cada casal só enxerga os próprios dados — garantido pelas [regras do Firestore](sessao/firestore.rules), que limitam leitura e escrita aos dois membros do casal.

---

<div align="center">
<sub>Feito com ❤️ para assistir junto.</sub>
</div>
