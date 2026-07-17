// Lumi — the Sessão mascot kit (V3 identity).
// Assets live in /public/assets/kit as flat <name>.png files.
// Reference by semantic name via the <Lumi> component or LUMI map.

const KIT = "/assets/kit";

// Semantic name -> file basename. Names mirror the V3 design canvas.
export const LUMI = {
  // estados & momentos
  welcome:        "estado_bem_vindo",
  empty:          "estado_tela_vazia",
  offline:        "estado_offline",
  error:          "estado_erro",
  milestone100:   "momento_100_filmes",
  milestone365:   "momento_365_dias",
  achievement:    "momento_conquista",
  retrospective:  "momento_retrospectiva",

  // poses
  waving:         "acenando",
  hugHeart:       "abracando_coracao",
  pointing:       "apontando",
  clapper:        "claquete",
  projector:      "projetando_luz",
  peeking:        "espiando",
  sitting:        "sentado",
  holdingPopcorn: "segurando_pipoca",
  holdingStar:    "segurando_estrela",
  cinemaSign:     "plaquinha_cinema",
  laptop:         "notebook",
  hiddenCurtain:  "escondido_cortina",

  // reações
  popcornFlying:  "reacao_pipoca_voando",
  confetti:       "reacao_confete",
  fireworks:      "reacao_fogos",
  celebrating:    "reacao_comemorando",
  clappingHands:  "reacao_batendo_palmas",
  hearts:         "reacao_coracao",
  sparkle:        "reacao_brilho",
  stars:          "reacao_estrelas",
  waiting:        "reacao_esperando",
  thumbsUp:       "reacao_polegar_cima",

  // expressões
  happy:          "feliz",
  veryHappy:      "muito_feliz",
  inLove:         "apaixonado",
  proud:          "orgulhoso",
  sad:            "triste",
  thinking:       "pensativo",
  winking:        "piscando",
  surprised:      "surpreso",

  // microinterações
  notification:   "interacao_notificacao",
  medal:          "interacao_medalha",
  roulette:       "interacao_roleta",
  tooltip:        "interacao_tooltip",
  bottomSheet:    "interacao_bottom_sheet",

  // ui heads / avatar
  avatar:         "ui_avatar",
  headHappy:      "ui_cabeca_feliz",
  headSmiling:    "ui_cabeca_sorrindo",
  headNeutral:    "ui_cabeca_neutra",
  headSad:        "ui_cabeca_triste",
};

export const lumiSrc = name => `${KIT}/${LUMI[name] || name}.png`;

/**
 * <Lumi name="welcome" size={200} breathe />
 * - name: semantic key from LUMI (or a raw basename)
 * - size: width in px (height auto)
 * - breathe / float: idle micro-animations
 * - glow: soft golden aura behind Lumi
 */
export const Lumi = ({
  name,
  size = 160,
  breathe = false,
  float = false,
  glow = false,
  alt = "Lumi",
  className = "",
  style = {},
  ...rest
}) => {
  const cls = [
    "lumi",
    breathe && "lumi--breathe",
    float && "lumi--float",
    glow && "lumi--glow",
    className,
  ].filter(Boolean).join(" ");
  return (
    <img
      src={lumiSrc(name)}
      alt={alt}
      className={cls}
      style={{ width: size, height: "auto", ...style }}
      draggable={false}
      {...rest}
    />
  );
};

export default Lumi;
