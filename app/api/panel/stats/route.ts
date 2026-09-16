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
    const userMetadataList: { uid: string; creationTime: number }[] = [];

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let pageToken: string | undefined;

    do {
      const listUsersResult = await adminAuth.listUsers(1000, pageToken);

      for (const userRecord of listUsersResult.users) {
        totalUsers++;
        if (userRecord.emailVerified) verifiedUsers++;

        const hasGoogle = userRecord.providerData.some((p: any) => p.providerId === "google.com");
        const hasEmail = userRecord.providerData.some((p: any) => p.providerId === "password");
        if (hasGoogle) googleSignInUsers++;
        if (hasEmail) emailSignInUsers++;

        const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
        const lastSignInTime = userRecord.metadata.lastSignInTime
          ? new Date(userRecord.metadata.lastSignInTime).getTime()
          : 0;

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

        userMetadataList.push({ uid: userRecord.uid, creationTime });
      }
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    // Sort recents
    recentSignups.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());
    recentLogins.sort((a, b) => new Date(b.lastSignInTime).getTime() - new Date(a.lastSignInTime).getTime());

    // Compute subscription and calendar adoption safely per-user without collectionGroup
    let proUsers = 0;
    let legacyUsers = 0;
    let freeUsers = 0;
    let googleCalendarUsers = 0;

    try {
      const userDocPromises = userMetadataList.map(async (u) => {
        const isLegacy = u.creationTime < new Date("2026-09-13T00:00:00Z").getTime();
        if (isLegacy) {
          legacyUsers++;
          proUsers++;
        }

        try {
          const [subSnap, calSnap] = await Promise.all([
            !isLegacy ? adminDb.doc(`users/${u.uid}/settings/subscription`).get().catch(() => null) : null,
            adminDb.doc(`users/${u.uid}/settings/calendar`).get().catch(() => null),
          ]);

          if (!isLegacy) {
            const sub = subSnap && subSnap.exists ? subSnap.data() : { plan: "free", status: "canceled" };
            const isPro = sub?.plan === "pro" && (sub?.status === "active" || sub?.status === "trialing");
            if (isPro) proUsers++;
            else freeUsers++;
          }

          if (calSnap && calSnap.exists && calSnap.data()?.connected) {
            googleCalendarUsers++;
          }
        } catch (e) {
          console.warn(`Error fetching settings for ${u.uid}:`, e);
          if (!isLegacy) freeUsers++;
        }
      });

      await Promise.all(userDocPromises);
    } catch (e) {
      console.warn("Could not query user settings documents:", e);
    }

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
    return NextResponse.json({ error: error.message || "Failed to load stats" }, { status: 500 });
  }
}

export const GET = (req: NextRequest) => withAdminAuth(req, handler);
