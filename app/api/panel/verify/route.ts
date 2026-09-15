import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-middleware";

export const GET = (req: NextRequest) => {
  return withAdminAuth(req, async (_req, context) => {
    return NextResponse.json({
      isAdmin: true,
      uid: context.uid,
      email: context.email,
    });
  });
};
