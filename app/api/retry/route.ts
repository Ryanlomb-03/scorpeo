import { NextRequest, NextResponse } from "next/server";
import { modelRouter } from "@/lib/modelRouter";

export async function POST(req: Request) {
  try {
    const { messageId, conversationId } = await req.json();

    if (!messageId || !conversationId) {
      return NextResponse.json({ error: "messageId and conversationId required" }, { status:400 });
    }

    // For guest mode, return error (localStorage doesn't support retry)
    return NextResponse.json({ error: "Retry not available in guest mode" }, { status: 400 });
  } catch (error) {
    console.error("Retry API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint to retrieve message versions
export async function GET(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    // Return empty array (localStorage doesn't support versions)
    return NextResponse.json([]);
  } catch (error) {
    console.error("GET /api/retry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}