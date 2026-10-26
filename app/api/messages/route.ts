import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    // Return empty array (localStorage handles actual storage)
    return NextResponse.json([]);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, conversationId, role, content } = await request.json();
    
    if (!id || !conversationId || !role || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Return the message object (localStorage handles actual storage)
    const message = {
      id,
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString()
    };

    return NextResponse.json(message);
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
