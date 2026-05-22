import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BG9e9lycq2PgLJzbOm0SKj3rdq8ZcdGS9MjaZUNQd6wwzDogWptiu_i5t6qRUIg8ly4b_OkNEEQJ9-TORHQgl9w";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "AjYQHVPktUMewp7xy9in2nuGPbk6MLbWV-32nfwSgFM";

webpush.setVapidDetails(
  "mailto:notifications@garciaamar.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptions, title, body: notifBody } = body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ error: "No subscriptions provided" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const payload = JSON.stringify({
      title,
      body: notifBody || "",
      url: "/",
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
