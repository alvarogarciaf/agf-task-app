import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "@/lib/firebase/config";

export interface UserSubscription {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: 'free' | 'pro';
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';
  currentPeriodEnd?: any;
}

export function useSubscription(uid: string | undefined, creationTime?: string) {
  const [subscription, setSubscription] = useState<UserSubscription>({
    plan: 'free',
    status: 'canceled',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSubscription({ plan: 'free', status: 'canceled' });
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(firestoreDb, `users/${uid}/settings/subscription`), (docSnap) => {
      if (docSnap.exists()) {
        setSubscription(docSnap.data() as UserSubscription);
      } else {
        setSubscription({ plan: 'free', status: 'canceled' });
      }
      setLoading(false);
    }, (error) => {
      console.error("Subscription listen error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  // Grandfather in users created before Sept 15, 2026
  const isLegacy = creationTime ? new Date(creationTime).getTime() < new Date("2026-09-15T00:00:00Z").getTime() : false;
  const isPro = isLegacy || (subscription.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing'));

  return { subscription, isPro, isLegacy, loading };
}
