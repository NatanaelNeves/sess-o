import { useEffect, useRef } from "react";
import { createBackStack } from "./backStack.js";

const backStack = typeof window !== "undefined" ? createBackStack(window) : null;

/** Fecha a camada com o "voltar" do celular enquanto `active` for verdadeiro. */
export default function useBackClose(onClose, active = true) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!active || !backStack) return;
    return backStack.open(() => closeRef.current?.());
  }, [active]);
}
