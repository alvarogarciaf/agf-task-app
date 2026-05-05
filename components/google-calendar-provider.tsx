"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/config";

interface GoogleCalendarContextType {
  accessToken: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | null>(null);

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error("useGoogleCalendar must be used within a GoogleCalendarProvider");
  }
  return context;
}

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("google_calendar_token");
    return null;
  });

  const connect = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        sessionStorage.setItem("google_calendar_token", credential.accessToken);
      }
    } catch (error) {
      console.error("Google Calendar connection failed:", error);
      throw error;
    }
  };

  const disconnect = () => {
    setAccessToken(null);
    sessionStorage.removeItem("google_calendar_token");
  };

  return (
    <GoogleCalendarContext.Provider 
      value={{ 
        accessToken, 
        isConnected: !!accessToken, 
        connect, 
        disconnect 
      }}
    >
      {children}
    </GoogleCalendarContext.Provider>
  );
}
