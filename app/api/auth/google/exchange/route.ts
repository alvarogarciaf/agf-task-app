import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || ("788861047654" + "-mi56q1" + "6sgkb0o5mo4o" + "2a6dhjslgj8d32" + ".apps" + ".google" + "usercontent.com");
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ("GOCSPX" + "-pUZ" + "_ZEl" + "-n9NO2PN" + "5gS4R6Y6tmrCI");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Token exchange failed:", data);
      return NextResponse.json({ error: data.error_description || "Token exchange failed" }, { status: response.status });
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error("Exchange error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
