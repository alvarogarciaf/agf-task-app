import { doc, getDoc, setDoc, deleteDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "./firebase/config";

export interface CalendarPreferences {
  connected: boolean;
  selectedCalendarId: string;
  connectedAt: string;
  refreshToken?: string | null;
}

const DEFAULT_PREFS: CalendarPreferences = {
  connected: false,
  selectedCalendarId: "primary",
  connectedAt: "",
  refreshToken: null,
};

function prefsDocRef(uid: string) {
  return doc(firestoreDb, "users", uid, "settings", "calendar");
}

/** Read calendar preferences from Firestore once. */
export async function getCalendarPreferences(uid: string): Promise<CalendarPreferences> {
  try {
    const snap = await getDoc(prefsDocRef(uid));
    if (snap.exists()) {
      return { ...DEFAULT_PREFS, ...snap.data() } as CalendarPreferences;
    }
  } catch (err) {
    console.error("[calendar-prefs] Failed to read:", err);
  }
  return { ...DEFAULT_PREFS };
}

/** Subscribe to calendar preferences (real-time). Returns an unsubscribe function. */
export function onCalendarPreferences(
  uid: string,
  callback: (prefs: CalendarPreferences) => void
): Unsubscribe {
  return onSnapshot(
    prefsDocRef(uid),
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_PREFS, ...snap.data() } as CalendarPreferences);
      } else {
        callback({ ...DEFAULT_PREFS });
      }
    },
    (err) => {
      console.error("[calendar-prefs] Snapshot error:", err);
      callback({ ...DEFAULT_PREFS });
    }
  );
}

/** Save calendar preferences to Firestore. */
export async function setCalendarPreferences(
  uid: string,
  prefs: Partial<CalendarPreferences>
): Promise<void> {
  try {
    await setDoc(prefsDocRef(uid), prefs, { merge: true });
  } catch (err) {
    console.error("[calendar-prefs] Failed to write:", err);
    throw err;
  }
}

/** Clear calendar preferences (disconnect). */
export async function clearCalendarPreferences(uid: string): Promise<void> {
  try {
    await setDoc(prefsDocRef(uid), {
      connected: false,
      selectedCalendarId: "primary",
      connectedAt: "",
    });
  } catch (err) {
    console.error("[calendar-prefs] Failed to clear:", err);
    throw err;
  }
}
