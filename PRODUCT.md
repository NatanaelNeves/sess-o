# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Também empacotado como app Android/iOS via Capacitor, com o mesmo design web. Hoje a instalação pública é só pelo navegador, como PWA.)

## Users

Casais brasileiros que assistem filmes e séries juntos — no sofá ou no cinema. Cada pessoa tem a própria conta, e as duas se conectam num diário compartilhado por um código de convite. Quem chega costuma vir de duas formas: descobrindo o app sozinho, ou abrindo o link de convite que a outra pessoa mandou.

## Product Purpose

Um diário privado de cinema do casal: registrar o que assistiram, cada um dar a própria nota, decidir juntos o que ver e relembrar a história de vocês (retrospectiva, "nesse dia", conquistas). Sucesso é o casal voltar depois de cada sessão e quando não sabe o que ver.

## Positioning

Não é catálogo nem lista compartilhada: as duas notas são individuais e protegidas (ninguém escreve a nota do outro), e delas nascem a nota do casal, a compatibilidade e a retrospectiva. As ferramentas de escolher a dois (Match, Lumi adivinha, roleta, programação do dia) atacam o "o que vamos ver hoje?".

## Operating Context

Uso no celular, à noite, antes e depois de assistir. Ritual semanal de escolher o filme; registro logo após a sessão; idas ao cinema marcadas com ingresso e lembrete.

## Capabilities and Constraints

- Login com Google, e-mail/senha e Apple (só no iPhone). Convite por código de 8 caracteres ou link `?convite=CÓDIGO`.
- Filmes e séries vêm do TMDB (pôsteres sob os termos do TMDB; "não endossado pelo TMDB").
- Gratuito para os dois (confirmado em 2026-11-09).
- Instalação: pelo navegador (PWA). Não há link público de loja ainda.
- Privacidade: só o casal vê o diário; exclusão de conta e "sair do diário" disponíveis; sem publicidade comportamental.

## Brand Commitments

- Nome "Sessão"; mascote Lumi, um pequeno projetor (kit de poses em `sessao/public/assets/kit/`).
- Voz em português do Brasil, afetuosa e leve, sem culpar o casal pela frequência.
- Identidade visual "A cabine do Lumi" já implementada (tokens em `sessao/src/theme.css`).

## Evidence on Hand

- Funcionalidades reais descritas no código (`sessao/src/App.jsx`, `sessao/src/ui/*`).
- Não há depoimentos, número de usuários, avaliações de loja nem imprensa. Não inventar prova social.

## Product Principles

1. O diário é do casal: nada que exponha um para o outro sem querer, nada público.
2. Cada pessoa tem voz própria (a nota individual) antes da média.
3. Ajudar a decidir vale tanto quanto guardar.
4. Afeto sem cobrança: o app nunca faz o casal se sentir em falta.
