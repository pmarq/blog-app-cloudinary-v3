import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/firebase/client";

export async function getReadyIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    return currentUser.getIdToken(true);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Sessão necessária. Faça login novamente."));
    }, 15000);

    const unsubscribe = onIdTokenChanged(
      auth,
      async (user) => {
        if (!user) {
          return;
        }

        try {
          const token = await user.getIdToken(true);
          if (!token) {
            clearTimeout(timeout);
            unsubscribe();
            reject(new Error("Sessão necessária. Faça login novamente."));
            return;
          }

          clearTimeout(timeout);
          unsubscribe();
          resolve(token);
        } catch (error) {
          clearTimeout(timeout);
          unsubscribe();
          reject(error);
        }
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });
}
