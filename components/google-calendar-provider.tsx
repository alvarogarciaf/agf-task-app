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
import { auth } from "@/lib/firebase/config";
import { useAuth } from "@/components/auth-provider";
import {
  onCalendarPreferences,
  setCalendarPreferences,
  clearCalendarPreferences,
  type CalendarPreferences,
} from "@/lib/calendar-preferences";
import { toast } from "sonner";

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

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = localStorage.getItem("gcal_access_token");
    const expiresAt = localStorage.getItem("gcal_token_expires_at");
    if (cached && expiresAt && parseInt(expiresAt, 10) > Date.now()) {
      return cached;
    }
    return null;
  });
  const [prefs, setPrefs] = useState<CalendarPreferences>({
    connected: false,
    selectedCalendarId: "primary",
    connectedAt: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const tokenRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertShownRef = useRef(false);

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

  // ─── Load Google Identity Services script ────────────────────────
  useEffect(() => {
    if (document.getElementById("gsi-client-script")) return;
    const script = document.createElement("script");
    script.id = "gsi-client-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // ─── Auto-acquire token when prefs say "connected" ─────────────────
  useEffect(() => {
    if (!prefs.connected || isConnecting || !uid) return;

    if (!accessToken) {
      acquireTokenSilently();
    } else {
      // If we have a token loaded from localStorage, ensure refresh timer is scheduled
      scheduleRefresh();
    }
  }, [prefs.connected, accessToken, uid, isConnecting]);

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
    if (!prefs.refreshToken) {
      setAccessToken(null);
      localStorage.removeItem("gcal_access_token");
      localStorage.removeItem("gcal_token_expires_at");
      if (!alertShownRef.current) {
        toast.error("Google Calendar session expired. Please go to Settings to reconnect.", { id: "gcal_expired", duration: 8000 });
        alertShownRef.current = true;
      }
      return null;
    }

    try {
      const res = await fetch("/api/auth/google/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: prefs.refreshToken }),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          console.warn("[calendar] Stale or revoked refresh token (400), auto-disconnecting...");
          await disconnect();
          toast.error("Google Calendar connection has been revoked or expired. Please reconnect.", { id: "gcal_expired", duration: 8000 });
          alertShownRef.current = true;
          return null;
        }
        throw new Error("Refresh failed");
      }
      
      const data = await res.json();

      const expiresAt = Date.now() + 50 * 60 * 1000;
      localStorage.setItem("gcal_access_token", data.access_token);
      localStorage.setItem("gcal_token_expires_at", expiresAt.toString());
      setAccessToken(data.access_token);
      alertShownRef.current = false;
      scheduleRefresh();
      return data.access_token;
    } catch (e) {
      console.error("[calendar] Silent token refresh failed:", e);
      setAccessToken(null);
      if (!alertShownRef.current) {
        toast.error("Failed to refresh Google Calendar connection. Please reconnect.", { id: "gcal_expired", duration: 8000 });
        alertShownRef.current = true;
      }
      return null;
    }
  };

  // ─── Manual connect (the "Connect Google Calendar" button) ─────────
  const connect = async () => {
    if (!uid) throw new Error("Not authenticated");

    setIsConnecting(true);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "788861047654-mi56q16sgkb0o5mo4o2a6dhjslgj8d32.apps.googleusercontent.com";
      if (!clientId) throw new Error("Google Client ID not configured");

      const code = await new Promise<string>((resolve, reject) => {
        // @ts-ignore
        const client = google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          ux_mode: "popup",
          prompt: "consent",
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.code);
            }
          },
        });
        client.requestCode();
      });

      const res = await fetch("/api/auth/google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error("Failed to exchange auth code");
      const data = await res.json();

      const expiresAt = Date.now() + 50 * 60 * 1000;
      localStorage.setItem("gcal_access_token", data.access_token);
      localStorage.setItem("gcal_token_expires_at", expiresAt.toString());
      setAccessToken(data.access_token);
      alertShownRef.current = false;
      scheduleRefresh();

      await setCalendarPreferences(uid, {
        connected: true,
        connectedAt: new Date().toISOString(),
        refreshToken: data.refresh_token || prefs.refreshToken, // Google might not send refresh token if already granted
      });
      toast.success("Calendar connected permanently!");
    } catch (error) {
      console.error("[calendar] Connection failed:", error);
      toast.error("Connection failed.");
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // ─── Disconnect ────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!uid) return;

    setAccessToken(null);
    localStorage.removeItem("gcal_access_token");
    localStorage.removeItem("gcal_token_expires_at");
    alertShownRef.current = false;
    
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
