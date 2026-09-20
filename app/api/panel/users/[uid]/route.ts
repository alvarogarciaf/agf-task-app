import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { getUser, deleteUser, updateUser, generatePasswordResetLink, firestoreGet, firestoreList, firestoreDelete, firestoreBatchDelete, storageDeleteFiles } from "@/lib/firebase/admin-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = async (req: NextRequest, { params }: { params: Promise<{ uid: string }> }) => {
  return withAdminAuth(req, async () => {
    try {
      const { uid } = await params;
      const userRecord = await getUser(uid);
      
      const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
      const isLegacy = creationTime < new Date("2026-09-13T00:00:00Z").getTime();
      
      const subDoc = await firestoreGet(`users/${uid}/settings/subscription`);
      const sub = subDoc.exists ? subDoc.data() : { plan: 'free', status: 'canceled' };
      const isPro = isLegacy || (sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing'));

      let authProvider = 'email';
      const hasGoogle = userRecord.providerData.some((p) => p.providerId === 'google.com');
      const hasEmail = userRecord.providerData.some((p) => p.providerId === 'password');
      if (hasGoogle && hasEmail) authProvider = 'both';
      else if (hasGoogle) authProvider = 'google';

      // Usage metrics
      const taskDocs = await firestoreList(`users/${uid}/tasks`).catch(() => []);
      let taskCount = 0;
      let openTaskCount = 0;
      let noteCount = 0;
      for (const doc of taskDocs) {
        const data = doc.data();
        if (data?._deleted) continue;
        if (data?.type === 'note') noteCount++;
        else {
          taskCount++;
          if (data?.status === 'Open') openTaskCount++;
        }
      }

      const projectDocs = await firestoreList(`users/${uid}/projects`).catch(() => []);
      let projectCount = 0;
      for (const doc of projectDocs) {
        if (!doc.data()?._deleted) projectCount++;
      }

      // Features
      const calendarDoc = await firestoreGet(`users/${uid}/settings/calendar`);
      const calendarData = calendarDoc.exists ? calendarDoc.data() : {};
      
      const pushDocs = await firestoreList(`users/${uid}/push_subscriptions`, { limit: 1 }).catch(() => []);
      const pushNotificationsEnabled = pushDocs.length > 0;

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
        usage: { taskCount, openTaskCount, noteCount, projectCount },
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
        const user = await getUser(uid);
        if (!user.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });
        const link = await generatePasswordResetLink(user.email);
        return NextResponse.json({ link });
      }

      const updateData: any = {};
      if (typeof updates.disabled === 'boolean') updateData.disabled = updates.disabled;
      if (typeof updates.displayName === 'string') updateData.displayName = updates.displayName;
      if (typeof updates.emailVerified === 'boolean') updateData.emailVerified = updates.emailVerified;

      if (Object.keys(updateData).length > 0) {
        await updateUser(uid, updateData);
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
      
      const subcollections = [
        "tasks", "projects", "persons", "contexts", "tags",
        "urgencies", "saved_views", "push_subscriptions", "messages"
      ];
      
      for (const sub of subcollections) {
        const docs = await firestoreList(`users/${uid}/${sub}`).catch(() => []);
        if (docs.length > 0) {
          await firestoreBatchDelete(docs.map((d) => d.ref.path));
        }
      }

      const settingsDocs = await firestoreList(`users/${uid}/settings`).catch(() => []);
      if (settingsDocs.length > 0) {
        await firestoreBatchDelete(settingsDocs.map((d) => d.ref.path));
      }

      await firestoreDelete(`users/${uid}`);

      // Delete directory entries
      const dirDocs = await firestoreList("directory_by_email", {
        where: { field: "uid", op: "EQUAL", value: uid }
      }).catch(() => []);
      if (dirDocs.length > 0) {
        await firestoreBatchDelete(dirDocs.map((d) => d.ref.path));
      }

      // Delete storage files
      try {
        await storageDeleteFiles(`users/${uid}/`);
      } catch (e: any) {
        console.warn("Storage deletion skipped/failed:", e.message);
      }

      await deleteUser(uid);

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("[user delete] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
};
