"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/");
      return;
    }

    const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
    if (user.uid === adminUid) {
      setIsAdmin(true);
      setLoading(false);
    } else {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchApi = async (url: string, options?: RequestInit) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not authenticated");
    
    const token = await currentUser.getIdToken();
    
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    
    return fetch(url, {
      ...options,
      headers,
    });
  };

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
