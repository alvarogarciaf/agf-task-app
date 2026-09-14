import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

export const handleWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value());
    const signature = request.headers["stripe-signature"];

    if (!signature) {
      response.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          // In some cases metadata might be inside subscription_details or directly on session
          const uid = session.metadata?.firebaseUID;
          
          if (uid && session.subscription) {
            await db.doc(`users/${uid}/subscription`).set({
              stripeSubscriptionId: session.subscription as string,
              plan: "pro",
              status: "active",
            }, { merge: true });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const uid = subscription.metadata?.firebaseUID;
          
          if (uid) {
            const status = subscription.status;
            const plan = status === "active" || status === "trialing" ? "pro" : "free";
            
            await db.doc(`users/${uid}/subscription`).set({
              stripeSubscriptionId: subscription.id,
              status: status,
              plan: plan,
              currentPeriodEnd: admin.firestore.Timestamp.fromMillis((subscription as any).current_period_end * 1000)
            }, { merge: true });
          }
          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      response.status(200).send({ received: true });
    } catch (err) {
      console.error("Error processing webhook:", err);
      response.status(500).send("Internal Server Error");
    }
  }
);
