import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripePriceId = defineString("STRIPE_PRICE_ID_PRO");

export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const email = request.auth?.token.email;

    const stripe = new Stripe(stripeSecretKey.value());

    const db = getFirestore();
    const subDoc = await db.doc(`users/${uid}/subscription`).get();
    let customerId = subDoc.data()?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email,
        metadata: { firebaseUID: uid },
      });
      customerId = customer.id;
      // Pre-create the subscription document to store the customer ID
      await db.doc(`users/${uid}/subscription`).set({ stripeCustomerId: customerId, plan: 'free' }, { merge: true });
    }

    const origin = request.rawRequest.headers.origin || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId.value(),
          quantity: 1,
        },
      ],
      success_url: `${origin}/?upgrade=success`,
      cancel_url: `${origin}/?upgrade=canceled`,
      subscription_data: {
        metadata: { firebaseUID: uid }
      }
    });

    return { url: session.url };
  }
);
