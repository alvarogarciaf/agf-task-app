"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
exports.handleWebhook = (0, https_1.onRequest)({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (request, response) => {
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const signature = request.headers["stripe-signature"];
    if (!signature) {
        response.status(400).send("Missing stripe-signature header");
        return;
    }
    let event;
    try {
        event = stripe.webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
    }
    catch (err) {
        console.error("Webhook signature verification failed.", err.message);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    const db = (0, firestore_1.getFirestore)();
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                // In some cases metadata might be inside subscription_details or directly on session
                const uid = session.metadata?.firebaseUID;
                const customer = session.customer;
                if (uid && session.subscription) {
                    await db.doc(`users/${uid}/settings/subscription`).set({
                        stripeSubscriptionId: session.subscription,
                        plan: "pro",
                        status: "active",
                    }, { merge: true });
                }
                if (uid && customer) {
                    // Save customer ID if missing
                    await db.doc(`users/${uid}/settings/subscription`).set({
                        stripeCustomerId: customer
                    }, { merge: true });
                }
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const uid = subscription.metadata?.firebaseUID;
                if (uid) {
                    const status = subscription.status;
                    const plan = status === "active" || status === "trialing" ? "pro" : "free";
                    await db.doc(`users/${uid}/settings/subscription`).set({
                        stripeSubscriptionId: subscription.id,
                        status: status,
                        plan: plan,
                        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
                    }, { merge: true });
                }
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        response.status(200).send({ received: true });
    }
    catch (err) {
        console.error("Error processing webhook:", err);
        response.status(500).send("Internal Server Error");
    }
});
//# sourceMappingURL=handleWebhook.js.map