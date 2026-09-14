import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const GET = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      const userRecord = await adminAuth.getUser(uid);
      
      const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
      const isLegacy = creationTime < new Date("2026-09-13T00:00:00Z").getTime();
      
      const subDoc = await adminDb.doc(`users/${uid}/settings/subscription`).get();
      const sub = subDoc.exists ? subDoc.data() : { plan: 'free', status: 'canceled' };
      const isPro = isLegacy || (sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing'));

      let authProvider = 'email';
      const hasGoogle = userRecord.providerData.some((p: any) => p.providerId === 'google.com');
      const hasEmail = userRecord.providerData.some((p: any) => p.providerId === 'password');
      if (hasGoogle && hasEmail) authProvider = 'both';
      else if (hasGoogle) authProvider = 'google';

      // Usage metrics
      const tasksSnap = await adminDb.collection(`users/${uid}/tasks`).get();
      let taskCount = 0;
      let openTaskCount = 0;
      let noteCount = 0;
      tasksSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data.type === 'note') noteCount++;
        else {
          taskCount++;
          if (data.status === 'Open') openTaskCount++;
        }
      });

      const projectsSnap = await adminDb.collection(`users/${uid}/projects`).count().get();
      const projectCount = projectsSnap.data().count;

      // Features
      const calendarDoc = await adminDb.doc(`users/${uid}/settings/calendar`).get();
      const calendarData = calendarDoc.exists ? calendarDoc.data() : {};
      
      const pushSnap = await adminDb.collection(`users/${uid}/push_subscriptions`).limit(1).get();
      const pushNotificationsEnabled = !pushSnap.empty;

      const user = {
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
        usage: {
          taskCount,
          openTaskCount,
          noteCount,
          projectCount,
        },
        features: {
          googleCalendarConnected: !!calendarData?.connected,
          googleCalendarConnectedAt: calendarData?.connectedAt,
          pushNotificationsEnabled,
        }
      };

      return NextResponse.json({ user });
    } catch (error: any) {
      console.error("[user detail] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      const updates = await req.json();

      if (updates.action === 'reset_password') {
        const user = await adminAuth.getUser(uid);
        if (!user.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });
        const link = await adminAuth.generatePasswordResetLink(user.email);
        return NextResponse.json({ link });
      }

      const updateData: any = {};
      if (typeof updates.disabled === 'boolean') updateData.disabled = updates.disabled;
      if (typeof updates.displayName === 'string') updateData.displayName = updates.displayName;
      if (typeof updates.emailVerified === 'boolean') updateData.emailVerified = updates.emailVerified;

      if (Object.keys(updateData).length > 0) {
        await adminAuth.updateUser(uid, updateData);
      }

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[user update] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // In production, we could call the deleteUserAccount cloud function directly or duplicate its logic.
      // We will duplicate logic here for self-contained admin panel.
      
      const subcollections = [
        "tasks", "projects", "persons", "contexts", "tags",
        "urgencies", "saved_views", "push_subscriptions", "messages"
      ];
      
      for (const sub of subcollections) {
        const snap = await adminDb.collection(`users/${uid}/${sub}`).get();
        if (!snap.empty) {
          const batch = adminDb.batch();
          snap.docs.forEach((doc: any) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      const settingsSnap = await adminDb.collection(`users/${uid}/settings`).get();
      if (!settingsSnap.empty) {
        const settingsBatch = adminDb.batch();
        settingsSnap.docs.forEach((doc: any) => settingsBatch.delete(doc.ref));
        await settingsBatch.commit();
      }

      await adminDb.doc(`users/${uid}`).delete();

      const dirSnap = await adminDb.collection("directory_by_email").where("uid", "==", uid).get();
      if (!dirSnap.empty) {
        const dirBatch = adminDb.batch();
        dirSnap.docs.forEach((doc: any) => dirBatch.delete(doc.ref));
        await dirBatch.commit();
      }

      // We cannot import adminStorage easily here if it throws when no bucket is set,
      // but assuming it is set:
      try {
        const { adminStorage } = await import('@/lib/firebase/admin');
        const bucket = adminStorage.bucket();
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      } catch (e: any) {
        console.warn("Storage deletion skipped/failed:", e.message);
      }

      await adminAuth.deleteUser(uid);

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[user delete] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
