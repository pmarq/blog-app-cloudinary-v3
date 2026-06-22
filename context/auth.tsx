"use client";

import { auth } from "@/firebase/client";
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  ParsedToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { removeToken, setToken } from "./action";

type AuthContextType = {
  currentUser: User | null;
  authReady: boolean;
  customClaims: ParsedToken | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customClaims, setCustomClaims] = useState<ParsedToken | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Listener para mudanças na autenticação
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      try {
        setCurrentUser(user ?? null);
        if (user) {
          try {
            const tokenResult = await user.getIdTokenResult(true);
            const token = tokenResult.token;
            const refreshToken = user.refreshToken;
            const claims = tokenResult.claims;

            setCustomClaims(claims ?? null);

            if (token && refreshToken) {
              await setToken({
                token,
                refreshToken,
              });
            }
          } catch (error) {
            console.error("Erro ao obter token do usuário:", error);
          }
        } else {
          setCurrentUser(null);
          setCustomClaims(null);
          await removeToken();
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login com Google
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Usuário logado com Google:", result.user);

      const tokenResult = await result.user.getIdTokenResult(true);
      const token = tokenResult.token;
      const refreshToken = result.user.refreshToken;

      if (token && refreshToken) {
        await setToken({
          token,
          refreshToken,
        });
      }
    } catch (error) {
      console.error("Erro ao logar com Google:", error);
    }
  };

  // Login com Email e Senha
  const loginWithEmail = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      console.log("Usuário logado com email e senha:", user);

      const tokenResult = await user.getIdTokenResult(true);
      const token = tokenResult.token;
      const refreshToken = user.refreshToken;

      if (token && refreshToken) {
        await setToken({
          token,
          refreshToken,
        });
      }

      setCurrentUser(user);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Erro ao logar com email e senha:", error.message);
        throw new Error(error.message || "Erro ao realizar login.");
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error
      ) {
        const firebaseError = error as { code: string; message: string };
        console.error(
          "Erro ao logar com email e senha:",
          firebaseError.code,
          firebaseError.message
        );
        throw new Error(firebaseError.message || "Erro ao realizar login.");
      }

      console.error("Erro desconhecido ao logar com email e senha:", error);
      throw new Error("Erro desconhecido ao realizar login.");
    }
  };

  // Logout
  const logout = async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
      setCustomClaims(null);
      await removeToken();
      console.log("Usuário deslogado.");
    } catch (error) {
      console.error("Erro ao realizar logout:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authReady,
        customClaims,
        loginWithGoogle,
        loginWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider.");
  }
  return context;
};
