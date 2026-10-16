// Botão "voltar" do celular: enquanto houver alguma camada aberta (modal,
// painel, subpágina, aba fora do Início) existe UMA entrada de guarda no
// histórico. Voltar consome a guarda e fecha só a camada de cima; se ainda
// sobrar alguma, a guarda volta. A sincronização é adiada para que abrir e
// fechar no mesmo instante (troca de modal, StrictMode) não mexa no histórico.
export function createBackStack(win, schedule = fn => setTimeout(fn, 0)) {
  const stack = [];
  let guard = false;
  let ignorePops = 0;
  let pending = false;

  const sync = () => {
    pending = false;
    if (stack.length && !guard) {
      win.history.pushState({ sessaoLayer: true }, "");
      guard = true;
    } else if (!stack.length && guard) {
      guard = false;
      ignorePops++;
      win.history.back();
    }
  };
  const requestSync = () => {
    if (pending) return;
    pending = true;
    schedule(sync);
  };

  win.addEventListener("popstate", () => {
    if (ignorePops > 0) { ignorePops--; return; }
    if (!guard) return; // navegação comum, sem camada aberta
    guard = false;
    const top = stack.pop();
    top?.close();
    requestSync();
  });

  return {
    /** Abre uma camada; devolve a função que a remove quando ela fecha pela interface. */
    open(close) {
      const entry = { close };
      stack.push(entry);
      requestSync();
      return () => {
        const i = stack.indexOf(entry);
        if (i < 0) return; // já saiu pelo "voltar"
        stack.splice(i, 1);
        requestSync();
      };
    },
    get size() { return stack.length; },
  };
}
