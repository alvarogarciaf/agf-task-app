import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

async function handler() {
  try {
    const users = [];
    let pageToken: string | undefined;

    const settingsSnap = await adminDb.collectionGroup('settings').get();
    const userSubscriptions = new Map<string, any>();

    settingsSnap.forEach((doc: any) => {
      if (doc.id === 'subscription') {
        const uid = doc.ref.parent.parent?.id;
        if (uid) userSubscriptions.set(uid, doc.data());
      }
    });

    do {
      const listUsersResult = await adminAuth.listUsers(100, pageToken);
      const userList = listUsersResult.users;

      // Fetch task, note, and project counts for each user concurrently
      const usagePromises = userList.map(async (u) => {
        try {
          const [tasksSnap, projectsSnap] = await Promise.all([
            adminDb.collection(`users/${u.uid}/tasks`).select('type', '_deleted').get(),
            adminDb.collection(`users/${u.uid}/projects`).select('_deleted').get()
          ]);

          let taskCount = 0;
          let noteCount = 0;
          tasksSnap.forEach((doc: any) => {
            const data = doc.data();
            if (data._deleted) return;
            if (data.type === 'note') {
              noteCount++;
            } else {
              taskCount++;
            }
          });

          let projectCount = 0;
          projectsSnap.forEach((doc: any) => {
            const data = doc.data();
            if (data._deleted) return;
            projectCount++;
          });

          return {
            uid: u.uid,
            taskCount,
            noteCount,
            projectCount
          };
        } catch (e) {
          console.error(`Error fetching usage for user ${u.uid}:`, e);
          return {
            uid: u.uid,
            taskCount: 0,
            noteCount: 0,
            projectCount: 0
          };
        }
      });

      const usageResults = await Promise.all(usagePromises);
      const usageMap = new Map(usageResults.map((r) => [r.uid, r]));

      for (const userRecord of userList) {
        const creationTime = new Date(userRecord.metadata.creationTime!).getTime();
        const isLegacy = creationTime < new Date("2026-09-13T00:00:00Z").getTime();
        const sub = userSubscriptions.get(userRecord.uid) || { plan: 'free', status: 'canceled' };
        const isPro = isLegacy || (sub.plan === 'pro' && (sub.status === 'active' || sub.status === 'trialing'));
        
        let authProvider = 'email';
        const hasGoogle = userRecord.providerData.some((p: any) => p.providerId === 'google.com');
        const hasEmail = userRecord.providerData.some((p: any) => p.providerId === 'password');
        if (hasGoogle && hasEmail) authProvider = 'both';
        else if (hasGoogle) authProvider = 'google';

        const userUsage = usageMap.get(userRecord.uid) || { taskCount: 0, noteCount: 0, projectCount: 0 };

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
          usage: userUsage,
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
