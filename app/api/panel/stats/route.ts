import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

async function handler() {
  try {
    let totalUsers = 0;
    let verifiedUsers = 0;
    let googleSignInUsers = 0;
    let emailSignInUsers = 0;
    const recentSignups: any[] = [];
    const recentLogins: any[] = [];

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let pageToken: string | undefined;
    
    // First pass: collect user metadata
    const userMetadataMap = new Map<string, any>();
    do {
      const listUsersResult = await adminAuth.listUsers(1000, pageToken);
      
      for (const userRecord of listUsersResult.users) {
        totalUsers++;
        if (userRecord.emailVerified) verifiedUsers++;
        
        const hasGoogle = userRecord.providerData.some((p: any) => p.providerId === 'google.com');
        const hasEmail = userRecord.providerData.some((p: any) => p.providerId === 'password');
        if (hasGoogle) googleSignInUsers++;
        if (hasEmail) emailSignInUsers++;

        const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
        const lastSignInTime = userRecord.metadata.lastSignInTime ? new Date(userRecord.metadata.lastSignInTime).getTime() : 0;

        if (creationTime >= sevenDaysAgo) {
          recentSignups.push({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            creationTime: userRecord.metadata.creationTime,
          });
        }

        if (lastSignInTime >= oneDayAgo) {
          recentLogins.push({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            lastSignInTime: userRecord.metadata.lastSignInTime,
          });
        }

        userMetadataMap.set(userRecord.uid, { creationTime });
      }
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    // Sort recents
    recentSignups.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());
    recentLogins.sort((a, b) => new Date(b.lastSignInTime).getTime() - new Date(a.lastSignInTime).getTime());

    // Fetch subscriptions from Firestore
    let proUsers = 0;
    let legacyUsers = 0;
    let freeUsers = 0;

    const settingsSnap = await adminDb.collectionGroup('settings').get();
    const userSubscriptions = new Map<string, any>();
    
    settingsSnap.forEach((doc: any) => {
      if (doc.id === 'subscription') {
        const uid = doc.ref.parent.parent?.id;
        if (uid) {
          userSubscriptions.set(uid, doc.data());
        }
      }
    });

    // Compute pro/legacy based on first pass
    for (const [uid, meta] of userMetadataMap.entries()) {
      const isLegacy = meta.creationTime < new Date("2026-09-13T00:00:00Z").getTime();
      const sub = userSubscriptions.get(uid) || { plan: 'free', status: 'canceled' };
      const isPro = isLegacy || (sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing'));
      
      if (isPro) proUsers++;
      else freeUsers++;
      
      if (isLegacy) legacyUsers++;
    }

    // Google calendar users
    let googleCalendarUsers = 0;
    const calendarSnap = await adminDb.collectionGroup('calendar').get();
    calendarSnap.forEach((doc: any) => {
      if (doc.data().connected) {
        googleCalendarUsers++;
      }
    });

    return NextResponse.json({
      totalUsers,
      verifiedUsers,
      proUsers,
      legacyUsers,
      freeUsers,
      googleSignInUsers,
      emailSignInUsers,
      googleCalendarUsers,
      recentSignups: recentSignups.slice(0, 50),
      recentLogins: recentLogins.slice(0, 50),
    });

  } catch (error: any) {
    console.error("[stats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => withAdminAuth(req, handler);
