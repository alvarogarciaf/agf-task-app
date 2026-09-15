"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import Link from "next/link";
import { ShieldAlert, LogIn, ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [errorStatus, setErrorStatus] = useState<"NOT_LOGGED_IN" | "FORBIDDEN" | "SERVER_CONFIG" | "NETWORK_ERROR" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const checkUserAdmin = useCallback(async (currentUser: User | null) => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage("");

    if (!currentUser) {
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
      setErrorStatus("NOT_LOGGED_IN");
      return;
    }

    setUser(currentUser);

    // Fast check: if NEXT_PUBLIC_ADMIN_UID is baked into the bundle and matches
    const publicAdminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
    if (publicAdminUid && currentUser.uid === publicAdminUid) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    // Fallback/Server check: verify against the server-side ADMIN_UID
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/panel/verify", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setIsAdmin(true);
        setLoading(false);
      } else if (res.status === 403) {
        setIsAdmin(false);
        setLoading(false);
        setErrorStatus("FORBIDDEN");
        setErrorMessage("Your account is not authorized to access the Admin Panel.");
      } else if (res.status === 500) {
        const body = await res.json().catch(() => ({}));
        setIsAdmin(false);
        setLoading(false);
        setErrorStatus("SERVER_CONFIG");
        setErrorMessage(body.error || "Server configuration error in Vercel. Please check your environment variables.");
      } else {
        setIsAdmin(false);
        setLoading(false);
        setErrorStatus("FORBIDDEN");
        setErrorMessage(`Authorization check failed (status ${res.status}).`);
      }
    } catch (err: any) {
      setIsAdmin(false);
      setLoading(false);
      setErrorStatus("NETWORK_ERROR");
      setErrorMessage(err.message || "Network error while verifying admin permissions.");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      checkUserAdmin(currentUser);
    });

    return () => unsubscribe();
  }, [checkUserAdmin]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
          <span className="text-sm text-zinc-500">Checking admin permissions...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-lg text-center space-y-6">
          {errorStatus === "NOT_LOGGED_IN" ? (
            <>
              <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-600 dark:text-zinc-300">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Sign In Required</h2>
                <p className="text-sm text-zinc-500">
                  You must be signed in with your admin account to access the Admin Panel.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 transition-colors"
              >
                Go to Sign In
              </Link>
            </>
          ) : errorStatus === "SERVER_CONFIG" ? (
            <>
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Vercel Configuration Needed</h2>
                <p className="text-sm text-zinc-500 text-left bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {errorMessage}
                </p>
                <p className="text-xs text-zinc-400 text-left pt-1">
                  Make sure you have added <b>ADMIN_UID</b> and <b>FIREBASE_ADMIN_SERVICE_ACCOUNT</b> in your Vercel Project Settings &gt; Environment Variables.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => checkUserAdmin(auth.currentUser)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
                <Link
                  href="/"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" /> Main App
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-sm text-zinc-500">
                  {errorMessage || "You do not have permission to view the Admin Panel."}
                </p>
                {user && (
                  <p className="text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                    Signed in as: <span className="font-mono">{user.email || user.uid}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => firebaseSignOut(auth).then(() => window.location.href = "/")}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-medium"
                >
                  Sign Out
                </button>
                <Link
                  href="/"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" /> Main App
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ isAdmin, loading, fetchApi }}>
      {children}
    </AdminContext.Provider>
  );
}
