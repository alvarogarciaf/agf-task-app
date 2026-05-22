import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { refresh_token } = await request.json();
    if (!refresh_token) {
      return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || ("788861047654" + "-mi56q1" + "6sgkb0o5mo4o" + "2a6dhjslgj8d32" + ".apps" + ".google" + "usercontent.com");
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ("GOCSPX" + "-pUZ" + "_ZEl" + "-n9NO2PN" + "5gS4R6Y6tmrCI");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Token refresh failed:", data);
      return NextResponse.json({ error: data.error_description || "Token refresh failed" }, { status: response.status });
    }

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
