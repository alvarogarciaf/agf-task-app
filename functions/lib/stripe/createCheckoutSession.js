"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const firestore_1 = require("firebase-admin/firestore");
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripePriceId = (0, params_1.defineString)("STRIPE_PRICE_ID_PRO");
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [stripeSecretKey] }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const email = request.auth?.token.email;
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const db = (0, firestore_1.getFirestore)();
    const subDoc = await db.doc(`users/${uid}/settings/subscription`).get();
    let customerId = subDoc.data()?.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: email,
            metadata: { firebaseUID: uid },
        });
        customerId = customer.id;
        // Save customer ID so we don't recreate it later
        await db.doc(`users/${uid}/settings/subscription`).set({ stripeCustomerId: customerId, plan: 'free' }, { merge: true });
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
});
//# sourceMappingURL=createCheckoutSession.js.map