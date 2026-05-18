"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthCredential,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/config";
import { useAuth } from "@/components/auth-provider";
import {
  onCalendarPreferences,
  setCalendarPreferences,
  clearCalendarPreferences,
  type CalendarPreferences,
} from "@/lib/calendar-preferences";

interface GoogleCalendarContextType {
  accessToken: string | null;
  isConnected: boolean;
  selectedCalendarId: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  selectCalendar: (id: string) => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | null>(null);

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error("useGoogleCalendar must be used within a GoogleCalendarProvider");
  }
  return context;
}

/** Detect mobile / tablet browsers where popups are unreliable. */
function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent);
}

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<CalendarPreferences>({
    connected: false,
    selectedCalendarId: "primary",
    connectedAt: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const tokenRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Subscribe to Firestore calendar preferences ───────────────────
  useEffect(() => {
    if (!uid) {
      setPrefs({ connected: false, selectedCalendarId: "primary", connectedAt: "" });
      setAccessToken(null);
      return;
    }

    const unsub = onCalendarPreferences(uid, (newPrefs) => {
      setPrefs(newPrefs);
    });

    return () => unsub();
  }, [uid]);

  // ─── Handle redirect result (for mobile sign-in flow) ─────────────
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
            scheduleRefresh();
          }
        }
      })
      .catch((err) => {
        console.error("[calendar] Redirect result error:", err);
      });
  }, []);

  // ─── Auto-acquire token when prefs say "connected" ─────────────────
  useEffect(() => {
    if (!prefs.connected || accessToken || isConnecting || !uid) return;

    // The user has marked themselves as connected in Firestore, but we
    // don't have a token on this device yet. Try to silently get one.
    acquireTokenSilently();
  }, [prefs.connected, accessToken, uid]);

  // ─── Schedule token refresh ~50 min (before Google's 60 min expiry) ─
  const scheduleRefresh = useCallback(() => {
    if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);

    tokenRefreshTimer.current = setTimeout(async () => {
      console.log("[calendar] Token refresh triggered");
      await acquireTokenSilently();
    }, 50 * 60 * 1000); // 50 minutes
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
    };
  }, []);

  // ─── Silent token acquisition ──────────────────────────────────────
  const acquireTokenSilently = async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    try {
      // Check if the user has a Google credential cached by Firebase Auth.
      // This works when the user originally signed in with Google.
      // We re-authenticate silently using the existing session.
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/calendar.events");
      provider.addScope("https://www.googleapis.com/auth/calendar.readonly");

      // On desktop, reauthenticateWithPopup can run silently if the session
      // is still valid (no user interaction needed). On mobile, this may fail.
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        scheduleRefresh();
        return credential.accessToken;
      }
    } catch (err: any) {
      // If popup fails (mobile, blocked, etc.), that's okay — the user
      // will see the "Reconnect" prompt in settings.
      console.warn("[calendar] Silent token acquisition failed:", err.code || err.message);
    }

    return null;
  };

  // ─── Manual connect (the "Connect Google Calendar" button) ─────────
  const connect = async () => {
    if (!uid) throw new Error("Not authenticated");

    setIsConnecting(true);
    try {
      let credential: OAuthCredential | null = null;

      if (isMobileBrowser()) {
        // On mobile, use redirect flow — the result will be handled by
        // the getRedirectResult effect above.
        // Save to Firestore first so when the redirect returns, we know
        // the user intended to connect.
        await setCalendarPreferences(uid, {
          connected: true,
          connectedAt: new Date().toISOString(),
        });
        await signInWithRedirect(auth, googleProvider);
        // The page will navigate away at this point.
        return;
      }

      // Desktop: use popup
      const result = await signInWithPopup(auth, googleProvider);
      credential = GoogleAuthProvider.credentialFromResult(result);

      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        scheduleRefresh();

        await setCalendarPreferences(uid, {
          connected: true,
          connectedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("[calendar] Connection failed:", error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // ─── Disconnect ────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!uid) return;

    setAccessToken(null);
    if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);

    await clearCalendarPreferences(uid);
  };

  // ─── Select calendar ──────────────────────────────────────────────
  const selectCalendar = async (calendarId: string) => {
    if (!uid) return;
    setPrefs((prev) => ({ ...prev, selectedCalendarId: calendarId }));
    await setCalendarPreferences(uid, { selectedCalendarId: calendarId });
  };

  // ─── Refresh token (called when a 401 is detected) ────────────────
  const refreshToken = async (): Promise<string | null> => {
    const newToken = await acquireTokenSilently();
    return newToken;
  };

  const isConnected = prefs.connected && !!accessToken;

  return (
    <GoogleCalendarContext.Provider
      value={{
        accessToken,
        isConnected,
        selectedCalendarId: prefs.selectedCalendarId,
        connect,
        disconnect,
        selectCalendar,
        refreshToken,
      }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  );
}
