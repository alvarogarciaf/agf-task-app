import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

let isVapidInitialized = false;

function ensureVapidDetails() {
  if (isVapidInitialized) return;

  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_CONTACT_EMAIL) {
    throw new Error("Missing VAPID configuration: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_CONTACT_EMAIL are required");
  }

  webpush.setVapidDetails(
    `mailto:${VAPID_CONTACT_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  isVapidInitialized = true;
}

export async function POST(request: NextRequest) {
  try {
    ensureVapidDetails();
    const body = await request.json();
    const { subscriptions, title, body: notifBody, taskId, itemType, url } = body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ error: "No subscriptions provided" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const targetUrl = url || (taskId ? `/?objectId=${taskId}` : "/");

    const payload = JSON.stringify({
      title,
      body: notifBody || "",
      url: targetUrl,
      taskId: taskId || null,
      itemType: itemType || "task",
    });

    // Send push to all subscriptions concurrently
    const results = await Promise.allSettled(
      subscriptions.map((sub: webpush.PushSubscription) =>
        webpush.sendNotification(sub, payload)
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ succeeded, failed });
  } catch (err: any) {
    console.error("[Push API] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
