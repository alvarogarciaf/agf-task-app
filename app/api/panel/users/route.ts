import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

async function handler() {
  try {
    const users = [];
    let pageToken: string | undefined;

    const subscriptionsSnap = await adminDb.collectionGroup('subscription').get();
    const userSubscriptions = new Map<string, any>();

    subscriptionsSnap.forEach((doc: any) => {
      const uid = doc.ref.parent.parent?.id;
      if (uid) userSubscriptions.set(uid, doc.data());
    });

    do {
      const listUsersResult = await adminAuth.listUsers(100, pageToken);
      
      for (const userRecord of listUsersResult.users) {
        const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
        const isLegacy = creationTime < new Date("2026-09-15T00:00:00Z").getTime();
        const sub = userSubscriptions.get(userRecord.uid) || { plan: 'free', status: 'canceled' };
        const isPro = isLegacy || (sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing'));
        
        let authProvider = 'email';
        const hasGoogle = userRecord.providerData.some((p: any) => p.providerId === 'google.com');
        const hasEmail = userRecord.providerData.some((p: any) => p.providerId === 'password');
        if (hasGoogle && hasEmail) authProvider = 'both';
        else if (hasGoogle) authProvider = 'google';

        users.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
          authProvider,
          subscription: sub,
          isLegacy,
          isPro,
        });
      }
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("[users list] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => withAdminAuth(req, handler);

export const POST = async (req: NextRequest) => {
  return withAdminAuth(req, async () => {
    try {
      const { email, displayName, temporaryPassword } = await req.json();

      if (!email || !temporaryPassword) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
      }
      if (temporaryPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }

      const userRecord = await adminAuth.createUser({
        email,
        password: temporaryPassword,
        displayName: displayName || undefined,
        emailVerified: false,
      });

      let welcomeEmailSent = false;
      try {
        const passwordResetUrl = await adminAuth.generatePasswordResetLink(email);
        
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        
        const res = await fetch(`${origin}/api/panel/send-welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('authorization') || '',
          },
          body: JSON.stringify({
            email,
            displayName,
            passwordResetUrl,
          })
        });
        
        if (res.ok) {
          welcomeEmailSent = true;
        } else {
          console.error("Failed to send welcome email:", await res.text());
        }
      } catch (err) {
        console.error("Error generating/sending welcome email:", err);
      }

      return NextResponse.json({ 
        uid: userRecord.uid, 
        email: userRecord.email, 
        displayName: userRecord.displayName,
        welcomeEmailSent
      });

    } catch (error: any) {
      console.error("[users create] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
