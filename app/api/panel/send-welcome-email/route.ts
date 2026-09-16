import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";
import { renderWelcomeEmailHtml } from "@/lib/email-templates/welcome";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handler(request: NextRequest) {
  try {
    const { email, displayName, passwordResetUrl } = await request.json();

    if (!email || !passwordResetUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const html = renderWelcomeEmailHtml({ email, displayName, passwordResetUrl });

    // Ensure SMTP config exists (e.g. SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Skipping email send.");
      return NextResponse.json({ 
        sent: false, 
        message: "SMTP credentials not configured, but user was created." 
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Tasker AGF" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Welcome to Tasker AGF - Set your password",
      html,
    });

    return NextResponse.json({ sent: true });
  } catch (error: any) {
    console.error("[send-welcome-email] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}

export const POST = (req: NextRequest) => withAdminAuth(req, handler);
