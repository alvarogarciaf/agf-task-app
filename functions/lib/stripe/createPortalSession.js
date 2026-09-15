"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPortalSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const stripe_1 = __importDefault(require("stripe"));
const firestore_1 = require("firebase-admin/firestore");
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
exports.createPortalSession = (0, https_1.onCall)({ secrets: [stripeSecretKey] }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const db = (0, firestore_1.getFirestore)();
    const subDoc = await db.doc(`users/${uid}/settings/subscription`).get();
    const customerId = subDoc.data()?.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No Stripe customer found.");
    }
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const origin = request.rawRequest.headers.origin || "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/`,
    });
    return { url: session.url };
});
//# sourceMappingURL=createPortalSession.js.map