// Login do Google dentro do app Android (Capacitor).
// O Google bloqueia o login por popup/redirect dentro de WebViews, então no app
// o seletor de contas é o nativo do Android; ele devolve um token que entra no
// Firebase Auth do próprio web app. No navegador nada disso é usado.
import { Capacitor } from "@capacitor/core";
// Importado direto (não via import dinâmico): o plugin é um proxy do Capacitor e
// devolvê-lo de uma Promise faz o JS chamar `.then` nele, o que o Capacitor recusa.
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, reauthenticateWithCredential } from "firebase/auth";

export const isNativeApp = () => Capacitor.isNativePlatform();

async function googleCredential() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("O Google não devolveu o token de login.");
  return GoogleAuthProvider.credential(idToken);
}

export const nativeGoogleSignIn = async auth => signInWithCredential(auth, await googleCredential());
export const nativeGoogleReauth = async user => reauthenticateWithCredential(user, await googleCredential());
export async function nativeGoogleSignOut() {
  if (!isNativeApp()) return;
  try { await FirebaseAuthentication.signOut(); } catch (e) { console.error(e); }
}
