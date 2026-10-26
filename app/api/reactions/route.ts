import { NextRequest, NextResponse } from "next/server";

// GET user's reaction for a specific message
export async function GET(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    // Return null (localStorage handles actual storage)
    return NextResponse.json({ reaction: null });
  } catch (err) {
    console.error("GET /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST to create or remove a reaction
export async function POST(request: NextRequest) {
  try {
    const { messageId, reactionType } = await request.json();
    
    if (!messageId || !reactionType || !['like', 'dislike'].includes(reactionType)) {
      return NextResponse.json({ error: "Missing required fields or invalid reaction type" }, { status: 400 });
    }

    // Return success (localStorage handles actual storage)
    return NextResponse.json({ reaction: null, action: "created" });
  } catch (err) {
    console.error("POST /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE to remove a reaction
export async function DELETE(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    // Return success (localStorage handles actual storage)
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
