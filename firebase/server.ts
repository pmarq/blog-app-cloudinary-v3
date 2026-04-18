import admin from "firebase-admin";
import { getApps, ServiceAccount, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

// 1. Service Account do BLOG (Firestore)
const serviceAccount = {
  type: "service_account",
  project_id: "blog-app-tutorial-36121",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-shppm%40blog-app-tutorial-36121.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

// 2. Service Account do PORTAL (Firestore do real-estate)
const portalServiceAccount = {
  type: "service_account",
  project_id: "real-estate-app-4df1a",
  private_key_id: process.env.PORTAL_FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.PORTAL_FIREBASE_PRIVATE_KEY,
  client_email: process.env.PORTAL_FIREBASE_CLIENT_EMAIL,
  client_id: process.env.PORTAL_FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.PORTAL_FIREBASE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com",
};

// 3. Service Account do CORE (Auth centralizado)
const coreServiceAccount = {
  type: "service_account",
  project_id: process.env.CORE_FIREBASE_PROJECT_ID,
  private_key_id: process.env.CORE_FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.CORE_FIREBASE_PRIVATE_KEY,
  client_email: process.env.CORE_FIREBASE_CLIENT_EMAIL,
  client_id: process.env.CORE_FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.CORE_FIREBASE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com",
};

const apps = getApps();

let blogApp: App;
let portalApp: App;
let coreApp: App;

// Inicializa o app do Blog (Firestore do blog)
if (!apps.find((app) => app.name === "blog")) {
  blogApp = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
      storageBucket: "blog-app-tutorial-36121.appspot.com",
    },
    "blog"
  );
} else {
  blogApp = apps.find((app) => app.name === "blog")!;
}

// Inicializa o app do Portal (Firestore do portal/real-estate)
if (!apps.find((app) => app.name === "portal")) {
  portalApp = admin.initializeApp(
    {
      credential: admin.credential.cert(portalServiceAccount as ServiceAccount),
      storageBucket: "real-estate-app-4df1a.appspot.com",
    },
    "portal"
  );
} else {
  portalApp = apps.find((app) => app.name === "portal")!;
}

// Inicializa o app do Core (Auth centralizado)
if (!apps.find((app) => app.name === "core")) {
  coreApp = admin.initializeApp(
    {
      credential: admin.credential.cert(coreServiceAccount as ServiceAccount),
    },
    "core"
  );
} else {
  coreApp = apps.find((app) => app.name === "core")!;
}

// Exporte Firestore do blog e Auth centralizado (core)
export const firestore: Firestore = getFirestore(blogApp);
export const portalDb: Firestore = getFirestore(portalApp);
export const auth: Auth = getAuth(coreApp);
export const blogStorage: Storage = getStorage(blogApp);
export const portalStorage: Storage = getStorage(portalApp);

// Função utilitária (opcional)
export const getTotalPages = async (
  firestoreQuery: FirebaseFirestore.Query<
    FirebaseFirestore.DocumentData,
    FirebaseFirestore.DocumentData
  >,
  pageSize: number
) => {
  const queryCount = firestoreQuery.count();
  const countSnapshot = await queryCount.get();
  const countData = countSnapshot.data();
  const total = countData.count;
  const totalPages = Math.ceil(total / pageSize);
  return totalPages;
};

export { admin };
