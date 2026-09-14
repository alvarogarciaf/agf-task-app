import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

export const createPortalSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    const db = getFirestore();
    const subDoc = await db.doc(`users/${uid}/subscription`).get();
    const customerId = subDoc.data()?.stripeCustomerId;

    if (!customerId) {
      throw new HttpsError("failed-precondition", "No Stripe customer found.");
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const origin = request.rawRequest.headers.origin || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    return { url: session.url };
  }
);
