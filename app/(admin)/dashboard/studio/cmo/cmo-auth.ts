import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/firebase/client";

export async function getReadyIdToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onIdTokenChanged(
      auth,
      async (user) => {
        unsubscribe();

        try {
          if (!user) {
            reject(new Error("Sessão necessária. Faça login novamente."));
            return;
          }

          const token = await user.getIdToken(true);
          if (!token) {
            reject(new Error("Sessão necessária. Faça login novamente."));
            return;
          }

          resolve(token);
        } catch (error) {
          reject(error);
        }
      },
      reject,
    );
  });
}
