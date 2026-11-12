---
version: 1
slug: "sessao-src-ui-entrada-jsx"
primary_target: "sessao/src/ui/Entrada.jsx"
related_targets: ["sessao/src/App.jsx"]
---

## Scope

Página de entrada do Sessão (antes do login), web e app Capacitor. Modo: Persuade. Substitui os três slides de apresentação + tela de login.

## Audience and job

Casal (ou uma pessoa do casal) que chega sem saber o que é o Sessão, ou que abriu o link de convite da outra pessoa. Precisa entender em segundos: diário de cinema do casal, cada um com sua nota, decidir juntos o que ver, grátis, privado. Ação: entrar (Google, e-mail, Apple no iPhone).

## Proof and content

Recursos reais do app (Match/Lumi adivinha/roleta, registrar filme e série com episódio, cinema, nota individual + nota do casal, lista a dois, retrospectiva, nesse dia), privacidade real (só o casal vê, ninguém altera a nota do outro, sair/exportar/excluir), grátis, instalação pelo navegador. Sem depoimentos, números ou lojas: não inventar.

## Direction contract

THESIS: A fachada de um cinema de rua à noite anunciando "Em cartaz: vocês dois" — letreiro, bilheteria e a programação da noite. Recusa o hero dividido (texto + celular) e a fileira de cards iguais de recursos.

OWN-WORLD: Rua escura cacau; letreiro de painel pipoca iluminado com letras cacau de encaixe (Fraunces SOFT) em trilhos, moldura bombom com lâmpadas âmbar (lente) que correm; bilheteria com vidro escuro e guichê; programação impressa em fileiras com horários em lente tabulares e filetes finos; cachecol só na ação principal; bochecha nos corações da nota.

STORY: Quem chega lê o letreiro e a frase e entende o que é; vê a bilheteria e entra; quem rola descobre a noite (escolher, assistir, a nota — e prova a nota do casal com as próprias mãos), a entrada franca em três passos, as regras da casa (privacidade), como instalar, e a bilheteria de novo no fim.

FIRST VIEWPORT (revisto em 2026-11-12, a pedido: explicar o produto antes de pedir login, com a estrutura de jogoxodo.com): Topo fino com a marca e "Já tenho conta". Letreiro "Em cartaz: vocês dois"; abaixo, em palavras simples, o que é ("O diário de filmes e séries de vocês dois."), uma frase do que se faz, três garantias (grátis, só vocês veem, abre no navegador) e "O que tem no Sessão": atalhos que descem até cada parte da página. No celular a bilheteria vem depois disso e a barra de entrar fica fixa embaixo enquanto nenhum canhoto está na tela; a partir de 900px, texto à esquerda e bilheteria à direita, com os botões de entrar visíveis sem rolar. Convite: o letreiro diz "Guardaram um lugar pra você" e a bilheteria vem antes dos atalhos.

PROGRAMAÇÃO (2026-11-12): cada fileira diz a hora, que parte do app é, o benefício em uma frase e o que vem junto (lista com vistos, sem cara de botão). A agenda usa nomes (Sugestões, Decidir, Diário, Notas, Lista, Retrospectiva, Nesse dia), não horários. Depois dela, "E ainda cabe no diário": lista impressa, sem cards.

FORM: Programação da casa, 2º na lista ordenada (dealt order 4,2,3 com o ingresso à frente; usuário escolheu a programação), seed 5329870c. Assinatura: lâmpadas acendem em sequência e correm devagar (parado com reduced-motion); a fileira das 23h deixa provar a nota do casal (duas notas fictícias → NotaDoCasal ao vivo).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
