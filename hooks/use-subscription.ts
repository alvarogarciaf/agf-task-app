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

export function useSubscription(uid: string | undefined) {
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

    const unsub = onSnapshot(doc(firestoreDb, `users/${uid}/subscription`), (docSnap) => {
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

  const isPro = subscription.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing');

  return { subscription, isPro, loading };
}
