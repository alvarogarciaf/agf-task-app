import * as admin from "firebase-admin";

admin.initializeApp();

export { deleteUserAccount } from "./deleteUserAccount";
// Temporarily disable Stripe functions until secrets are configured
// export { createCheckoutSession } from "./stripe/createCheckoutSession";
// export { createPortalSession } from "./stripe/createPortalSession";
// export { handleWebhook } from "./stripe/handleWebhook";
