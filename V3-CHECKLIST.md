# Sessão V3 — Checklist de fidelidade ao Claude Design (Sessao-v3.dc.html)

`[x]` = implementado fiel · `[~]` = adaptado (motivo anotado) · `[ ]` = pendente

## Sistema visual global
- [x] Bottom nav v3: barra blur, ícone ativo em quadrado tintado, FAB central "+" gradiente vermelho elevado, cabeça do Lumi como aba do casal
- [x] FAB abre bottom sheet de adicionar com Lumi empoleirado na borda
- [x] Header da Home: saudação contextual ("Quarta à noite ✦") + nome do casal em Cormorant + avatar do Lumi com halo dourado (abre Configurações)
- [x] Sistema de pílulas: primário gradiente vermelho + sombra / claro / outline / outline dourado
- [x] Chips de filtro (ativo vermelho, "no cinema 🎟" dourado)
- [x] Cards #0f0f1c radius 18–22 em todo o app; notas na escala 0–10 com vírgula (8,8)
- [x] Top bar antiga removida; transição de página suave

## Home
- [x] Hero "Continue de onde pararam" (teal, progresso, ▶ Continuar, Lumi espiando)
- [x] Par Compatibilidade % (Cormorant dourado) + Próximo marco com cabeça do Lumi
- [x] "Última sessão" (card com pôster, "Ontem · em casa", ★ nota)
- [x] "Nesse dia" com memórias de anos anteriores
- [x] Atalhos: Roleta da noite + Modo cinema 🎟
- [x] Empty com CTA "Guardar a primeira memória"

## Série (detalhe)
- [x] Eyebrow "Série · assistindo juntos", card "Vocês pararam em", próximo episódio, Continuar assistindo, ❤ Assistimos juntos, ritmo (T2E4 · Hoje...)
- [x] Lumi sentado + frase itálica contextual ("Que maratona ✦") baseada no ritmo real

## Episódio concluído / celebrações
- [x] Modal 1 toque (Lumi pipoca, check teal, próximo episódio)
- [x] Conquista dourada com confetti (100 filmes, 50, 10, primeira)
- [x] "Virou memória ✦" ao concluir item da watchlist (nº da memória + meses de espera)

## Experiência premium
- [x] Splash · Loading skeleton · Empty · Offline · Erro ("Tentar de novo" outline)

## Registrar sessão
- [x] Header Lumi tooltip "Nova sessão / o que vocês assistiram hoje?"
- [x] Busca pílula com caret dourado + grid de pôsteres com seleção dourada
- [x] Sheet "A nota do casal": Lumi na borda, alça, chips Ana/Léo/Juntos (média dourada ao vivo), "Guardar memória"
- [x] Episódio onde pararam + toggle Assistimos juntos

## Watchlist
- [x] "Lista a dois / Queremos ver" + contagem dourada
- [x] Pills Todos / "{nome} quer" + atalho roleta
- [x] Rows com "{quem} quer · duração" e ❤ para prioridade alta
- [x] Nudge do Lumi apontando no rodapé
- [x] Detalhe: badge "na watchlist há N meses", frase do Lumi, quem adicionou, "Assistimos juntos →" (toque), Registrar sessão + Remover
- [~] Slider é acionado por toque (não arrasto físico) — mesma composição visual

## Retrospectiva (story-mode, 6 slides)
- [x] Barras de progresso, toque para avançar/voltar, fundo radial por slide
- [x] S1 abertura (Lumi cortina, "Abrir as cortinas ✦") · S2 contagem gigante · S3 gênero com bar chart · S4 filme do ano (pôster + Lumi estrela + citação real) · S5 recordes (maratona/discordância/mês/nota máxima) · S6 pôster final compartilhável (html-to-image → stories)
- [~] "Sessão mais tarde" substituído por "Nota máxima" (o app não guarda horário da sessão)

## Perfil + Estatísticas + Conquistas
- [x] Avatares sobrepostos gradiente, "juntos no Sessão desde...", 3 stats dourados (sessões/horas/compatíveis)
- [x] Fileira de conquistas → galeria completa (12 medalhas, progresso, bloqueadas grayscale, Lumi orgulhoso "faltam N")
- [x] Gênero favorito com Lumi apaixonado
- [x] 4 cards gradiente, gráfico sessões/mês (mês atual dourado), "X avalia", insight do Lumi pensativo

## Acervo
- [x] "O acervo de vocês / N memórias" + cabeça do Lumi
- [x] Busca pílula + chips (Tudo/Filmes/Séries/★9+/anos/no cinema 🎟) + toggle linha do tempo
- [x] Grid limpo com nota-pill no pôster
- [x] Dica com Lumi curioso · Busca sem resultado com Lumi confuso + CTA watchlist

## Detalhe do filme
- [x] Banner backdrop + pôster flutuante + título Cormorant + meta
- [x] NOTA DO CASAL (8,8 dourado) + notas individuais
- [x] Críticas com avatar gradiente/nome/data/citação + insight contextual do Lumi
- [x] Ações: Compartilhar ✦ (vermelho) + Editar + excluir

## Compartilhar (arte de designer)
- [x] Canvas novo: card roxo com borda dourada, "SESSÃO Nº", pôster com sombra, Cormorant, casal · data, ★ nota, marca do Lumi
- [x] Botões "Compartilhar nos stories ✦" claro + Salvar outline

## Onboarding + login + convite
- [x] Slide 1 "Oi! Eu sou o Lumi" · Slide 2 "Como funciona" (3 cards) · Slide 3 "Chame sua pessoa" + Google claro + dots animados
- [x] Convite com caixa tracejada dourada + Copiar (e no card de Configurações)
- [~] "Continuar com Apple" não incluído (exige provedor Apple no Firebase — decisão de produto)

## Configurações
- [x] Card do casal + código, toggles do Lumi (Comentários — desliga todas as falas do Lumi no app; Lembretes; "Nesse dia" — esconde a seção da Home), Conta (Exportar memórias/Privacidade/Sair), rodapé silhueta "Sessão · versão 3.0"

## Modo cinema
- [x] Hub âmbar: próxima sessão marcada (Firestore), lista de idas ao cinema com notas, rodapé Lumi pipoca
- [x] Marcar sessão (filme/data/hora/sala/lugares)
- [x] Ingresso creme com perfuração, admit two, código de barras, Lumi espiando, "Já assistimos ✦" → registrar com where=cinema
- [x] Check-in no dia da sessão ("Modo silencioso ativado", chips 🔕/🎟)

## Fora de escopo (do canvas)
- [~] Mockups de notificações do sistema operacional (push real exige backend/FCM; o toggle "Lembretes de sexta" já guarda a preferência)
