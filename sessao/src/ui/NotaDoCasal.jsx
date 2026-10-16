// A nota do casal como dois corações numa mesma régua: quanto mais parecidas as
// notas, mais perto eles ficam — e quando são iguais, viram um coração só.
const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2.1 0 3.6 1.2 4.4 2.6h2.4C14 6.2 15.5 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z";

const nota = v => (v * 2).toFixed(1).replace(".", ",");
const inicial = name => (name?.[0] || "?").toUpperCase();

const Coracao = ({ pos, initial, kind }) => (
  <span className={`ndc__coracao ndc__coracao--${kind}`} style={{ left: `${pos}%` }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={HEART}/></svg>
    <span>{initial}</span>
  </span>
);

export default function NotaDoCasal({ me, partner, verdict }) {
  const mine = me.rating || 0;
  const theirs = partner?.rating || 0;
  const both = mine > 0 && theirs > 0;
  const juntos = both && mine === theirs;
  const given = [mine, theirs].filter(Boolean);
  const avg = given.length ? given.reduce((a, b) => a + b, 0) / given.length : 0;
  const pos = r => (r / 5) * 100;

  const status = !mine
    ? "Dê a sua nota e veja onde ela fica perto da de vocês dois."
    : !partner
      ? "A nota de vocês"
      : !theirs
        ? `A nota de ${partner.name} aparece aqui quando chegar.`
        : verdict;

  return (
    <div className={`ndc ${juntos ? "ndc--juntos" : ""}`}>
      <div className="ndc__topo">
        <p className="ndc__status" aria-live="polite">{status}</p>
        <p className="ndc__media">
          <span>juntos</span>
          <b>{avg ? nota(avg) : "—"}</b>
        </p>
      </div>
      <div className="ndc__regua" role="img"
        aria-label={`Sua nota ${mine ? nota(mine) : "ainda não dada"}${partner ? `, nota de ${partner.name} ${theirs ? nota(theirs) : "ainda não dada"}` : ""}`}>
        <span className="ndc__trilho"/>
        {both && !juntos && (
          <span className="ndc__ponte" style={{ left: `${pos(Math.min(mine, theirs))}%`, width: `${Math.abs(pos(mine) - pos(theirs))}%` }}/>
        )}
        {juntos ? (
          <Coracao key="juntos" pos={pos(mine)} initial={`${inicial(me.name)}${inicial(partner.name)}`} kind="juntos"/>
        ) : (
          <>
            {partner && theirs > 0 && <Coracao pos={pos(theirs)} initial={inicial(partner.name)} kind="par"/>}
            {mine > 0 && <Coracao pos={pos(mine)} initial={inicial(me.name)} kind="eu"/>}
          </>
        )}
      </div>
      <div className="ndc__escala" aria-hidden="true"><span>0</span><span>5</span><span>10</span></div>
    </div>
  );
}
