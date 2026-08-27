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
  const inFlightRefreshPromise = useRef<Promise<string | null> | null>(null);

  // ─── Subscribe to Firestore calendar preferences ───────────────────
  useEffect(() => {
    if (!uid) {
      setPrefs({ connected: false, selectedCalendarId: "primary", connectedAt: "" });
      setAccessToken(null);
      return;
    }

    const unsub = onCalendarPreferences(uid, (newPrefs) => {
      setPrefs(newPrefs);
      // If Firestore contains a refresh token, back it up to localStorage for offline resilience
      if (newPrefs.refreshToken && typeof window !== "undefined") {
        localStorage.setItem("gcal_refresh_token", newPrefs.refreshToken);
      }
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

  // ─── Schedule token refresh ~50 min (before Google's 60 min expiry) ─
  const scheduleRefresh = useCallback((ms: number = 50 * 60 * 1000) => {
    if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);

    tokenRefreshTimer.current = setTimeout(async () => {
      console.log("[calendar] Scheduled token refresh triggered");
      await acquireTokenSilently();
    }, ms);
  }, []);

  // ─── Silent token acquisition ──────────────────────────────────────
  const acquireTokenSilently = async (): Promise<string | null> => {
    // If a refresh is already in flight, reuse the promise to prevent duplicate API requests
    if (inFlightRefreshPromise.current) {
      return inFlightRefreshPromise.current;
    }

    const doRefresh = async (): Promise<string | null> => {
      const effectiveRefreshToken =
        prefs.refreshToken ||
        (typeof window !== "undefined" ? localStorage.getItem("gcal_refresh_token") : null);

      if (!effectiveRefreshToken) {
        // If prefs aren't marked as connected, don't show any error
        if (!prefs.connected) return null;

        // If marked connected but no refresh token found anywhere, warn once
        if (!alertShownRef.current) {
          console.warn("[calendar] Connected state set but no refresh token available.");
          toast.error("Google Calendar session expired. Please reconnect in Settings.", {
            id: "gcal_expired",
            duration: 8000,
          });
          alertShownRef.current = true;
        }
        return null;
      }

      // Check if we are offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        console.log("[calendar] Offline, postponing token refresh");
        // Retry in 15 seconds when device is likely back online
        scheduleRefresh(15 * 1000);
        return accessToken;
      }

      try {
        const res = await fetch("/api/auth/google/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: effectiveRefreshToken }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Check if Google explicitly revoked or expired the grant
          if (res.status === 400 && (data.is_invalid_grant || data.error_code === "invalid_grant")) {
            console.warn("[calendar] Refresh token revoked or expired, disconnecting...");
            await disconnect();
            if (!alertShownRef.current) {
              toast.error("Google Calendar connection has expired. Please reconnect.", {
                id: "gcal_expired",
                duration: 8000,
              });
              alertShownRef.current = true;
            }
            return null;
          }

          // Transient server error (500, 429, 503) — schedule retry without alerting
          console.warn("[calendar] Transient refresh failure:", data.error || res.statusText);
          scheduleRefresh(30 * 1000); // Retry in 30s
          return accessToken;
        }

        const expiresAt = Date.now() + 50 * 60 * 1000;
        localStorage.setItem("gcal_access_token", data.access_token);
        localStorage.setItem("gcal_token_expires_at", expiresAt.toString());
        if (effectiveRefreshToken) {
          localStorage.setItem("gcal_refresh_token", effectiveRefreshToken);
        }

        setAccessToken(data.access_token);
        alertShownRef.current = false;
        scheduleRefresh(50 * 60 * 1000);

        // Auto-heal: If Firestore was missing the refresh token, write it back
        if (uid && !prefs.refreshToken && effectiveRefreshToken) {
          setCalendarPreferences(uid, { refreshToken: effectiveRefreshToken }).catch(() => {});
        }

        return data.access_token;
      } catch (e: any) {
        console.warn("[calendar] Silent token refresh network/fetch error (will retry):", e);
        // Do NOT wipe tokens on transient network errors; retry when network recovers
        scheduleRefresh(15 * 1000);
        return accessToken;
      }
    };

    inFlightRefreshPromise.current = doRefresh().finally(() => {
      inFlightRefreshPromise.current = null;
    });

    return inFlightRefreshPromise.current;
  };

  // ─── Auto-acquire token when prefs say "connected" ─────────────────
  useEffect(() => {
    if (!prefs.connected || isConnecting || !uid) return;

    if (!accessToken) {
      acquireTokenSilently();
    } else {
      scheduleRefresh();
    }
  }, [prefs.connected, isConnecting, uid]);

  // ─── Network reconnection & visibility listeners ───────────────────
  useEffect(() => {
    const handleOnlineOrVisible = () => {
      if (!prefs.connected || !uid) return;
      const expiresAt = localStorage.getItem("gcal_token_expires_at");
      const isExpired = !expiresAt || parseInt(expiresAt, 10) <= Date.now() + 5 * 60 * 1000;
      if (!accessToken || isExpired) {
        console.log("[calendar] App resumed / online - refreshing token");
        acquireTokenSilently();
      }
    };

    window.addEventListener("online", handleOnlineOrVisible);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleOnlineOrVisible();
      }
    });

    return () => {
      window.removeEventListener("online", handleOnlineOrVisible);
      if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
    };
  }, [prefs.connected, uid, accessToken]);

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
      if (data.refresh_token) {
        localStorage.setItem("gcal_refresh_token", data.refresh_token);
      }
      setAccessToken(data.access_token);
      alertShownRef.current = false;
      scheduleRefresh();

      const effectiveRefreshToken = data.refresh_token || prefs.refreshToken || localStorage.getItem("gcal_refresh_token");

      await setCalendarPreferences(uid, {
        connected: true,
        connectedAt: new Date().toISOString(),
        refreshToken: effectiveRefreshToken,
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
    localStorage.removeItem("gcal_refresh_token");
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
