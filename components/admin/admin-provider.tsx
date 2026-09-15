"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

interface AdminContextValue {
  isAdmin: boolean;
  loading: boolean;
  fetchApi: (url: string, options?: RequestInit) => Promise<Response>;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  loading: true,
  fetchApi: async () => new Response(null, { status: 500 }),
});

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen directly to Firebase Auth state to ensure the real Firebase user is loaded
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        router.push("/");
        return;
      }

      const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
      if (currentUser.uid === adminUid) {
        setIsAdmin(true);
        setLoading(false);
      } else {
        setIsAdmin(false);
        setLoading(false);
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchApi = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }

    let currentUser: User | null = auth.currentUser;
    if (!currentUser) {
      for (let i = 0; i < 10 && !currentUser; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        currentUser = auth.currentUser;
      }
    }

    if (!currentUser) {
      throw new Error("Not authenticated");
    }

    const token = await currentUser.getIdToken();

    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }, []);

  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ isAdmin, loading, fetchApi }}>
      {children}
    </AdminContext.Provider>
  );
}
