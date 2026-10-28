// Login do Google (e da Apple, no iPhone) dentro do app Capacitor.
// O Google bloqueia o login por popup/redirect dentro de WebViews, então no app
// o seletor de contas é o nativo; ele devolve um token que entra no
// Firebase Auth do próprio web app. No navegador nada disso é usado.
import { Capacitor } from "@capacitor/core";
// Importado direto (não via import dinâmico): o plugin é um proxy do Capacitor e
// devolvê-lo de uma Promise faz o JS chamar `.then` nele, o que o Capacitor recusa.
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, reauthenticateWithCredential } from "firebase/auth";

export const isNativeApp = () => Capacitor.isNativePlatform();

// A App Store exige "Entrar com a Apple" ao lado de qualquer login social (diretriz 4.8).
export const canSignInWithApple = () => Capacitor.getPlatform() === "ios";

async function googleCredential() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("O Google não devolveu o token de login.");
  return GoogleAuthProvider.credential(idToken);
}

// A Apple também entra no SDK nativo (skipNativeAuth: false): é ele que revoga o
// token da Apple quando a conta é excluída, como a App Store exige (diretriz 5.1.1).
async function appleSignIn() {
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: false });
  const { idToken, nonce, authorizationCode } = result.credential || {};
  if (!idToken) throw new Error("A Apple não devolveu o token de login.");
  return {
    credential: new OAuthProvider("apple.com").credential({ idToken, rawNonce: nonce }),
    authorizationCode,
  };
}

const usesApple = user => user.providerData.some(p => p.providerId === "apple.com");

export const nativeGoogleSignIn = async auth => signInWithCredential(auth, await googleCredential());
export const nativeAppleSignIn = async auth => signInWithCredential(auth, (await appleSignIn()).credential);

// Confirma a identidade antes da exclusão. Devolve o que precisa rodar logo
// antes de apagar o usuário (revogar o token da Apple, quando for o caso).
export async function nativeReauth(user) {
  if (!usesApple(user)) {
    await reauthenticateWithCredential(user, await googleCredential());
    return async () => {};
  }
  const { credential, authorizationCode } = await appleSignIn();
  await reauthenticateWithCredential(user, credential);
  return async () => {
    if (authorizationCode) await FirebaseAuthentication.revokeAccessToken({ token: authorizationCode });
  };
}

export async function nativeSignOut() {
  if (!isNativeApp()) return;
  try { await FirebaseAuthentication.signOut(); } catch (e) { console.error(e); }
}
