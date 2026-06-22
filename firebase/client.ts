// /firebase/client.ts
import { initializeApp, getApps } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { coreConfig } from "../lib/firebase/coreConfig"; // Auth centralizado
import { blogConfig } from "@/lib/firebase/blogConfig"; // Firestore do blog

let coreApp, blogApp;

// Auth centralizado no app padrão para compartilhar sessão
if (!getApps().some((app) => app.name === "[DEFAULT]")) {
  coreApp = initializeApp(coreConfig);
} else {
  coreApp = getApps().find((app) => app.name === "[DEFAULT]")!;
}
export const auth = getAuth(coreApp);
void setPersistence(auth, browserLocalPersistence).catch(() => null);

// Firestore e Storage do blog
if (!getApps().some((app) => app.name === "blog")) {
  blogApp = initializeApp(blogConfig, "blog");
} else {
  blogApp = getApps().find((app) => app.name === "blog")!;
}
export const db = getFirestore(blogApp);
export const storage = getStorage(blogApp); // Opcional, se for usar Storage do blog
