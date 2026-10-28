// Conta própria do Sessão: e-mail + senha no Firebase Auth (funciona igual na web
// e dentro do app, sem popup). O provedor "E-mail/senha" precisa estar ativo no
// Firebase Console → Authentication → Sign-in method.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  sendEmailVerification, updateProfile, EmailAuthProvider, reauthenticateWithCredential,
} from "firebase/auth";

export const MIN_PASSWORD = 8;

export const normalizeEmail = email => String(email || "").trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Validação antes de ir ao Firebase: mensagens imediatas e menos tentativas inúteis.
export function validateEmailForm({ mode, name, email, password }) {
  if (mode === "signup" && !String(name || "").trim()) return "Conte como você quer ser chamado.";
  if (!EMAIL_RE.test(normalizeEmail(email))) return "Esse e-mail não parece certo.";
  if (mode === "reset") return null;
  if (!password) return "Digite sua senha.";
  if (mode === "signup" && password.length < MIN_PASSWORD) return `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
  return null;
}

// Erros do Firebase Auth em português. Login errado não diz se o e-mail existe.
const MESSAGES = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Esse e-mail não parece certo.",
  "auth/email-already-in-use": "Esse e-mail já tem conta. Entre com ele — se foi criada pelo Google ou pela Apple, use o mesmo botão.",
  "auth/weak-password": `Escolha uma senha mais forte (mínimo de ${MIN_PASSWORD} caracteres).`,
  "auth/too-many-requests": "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
  "auth/operation-not-allowed": "Entrar com e-mail ainda não está disponível. Use o Google por enquanto.",
  "auth/user-disabled": "Essa conta foi desativada. Fale com o suporte.",
  "auth/missing-password": "Digite sua senha.",
};
export const authErrorMessage = error =>
  MESSAGES[error?.code] || "Não deu certo agora. Tente de novo em instantes.";

export async function signUpWithEmail(auth, { name, email, password }) {
  const { user } = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
  await updateProfile(user, { displayName: String(name).trim().slice(0, 40) });
  // a verificação não bloqueia o uso: só confirma que o e-mail de recuperação é dele
  sendEmailVerification(user).catch(e => console.error(e));
  return user;
}

export const signInWithEmail = (auth, { email, password }) =>
  signInWithEmailAndPassword(auth, normalizeEmail(email), password);

export const sendReset = (auth, email) => sendPasswordResetEmail(auth, normalizeEmail(email));

export const hasPassword = user => !!user?.providerData?.some(p => p.providerId === "password");

export const reauthWithPassword = (user, password) =>
  reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
