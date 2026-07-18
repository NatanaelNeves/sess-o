import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// A config web do Firebase NÃO é segredo — o Google documenta que ela pode ser
// pública no código do cliente (a segurança vem das regras do Firestore + Auth).
// Por isso ela fica embutida como padrão e o app sempre inicializa, mesmo sem os
// secrets no CI. As variáveis de ambiente, se existirem, têm prioridade.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || "AIzaSyAfoOKUg7pnkTCmly8qteuZzR6nv_qugV4",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "sess-80b2c.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "sess-80b2c",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "sess-80b2c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "540199190223",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "1:540199190223:web:259784e09619c1c908c1ba",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
// Storage — fotos das memórias de cinema (casal, ingressos, pipoca)
export const storage = getStorage(app);
