import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Return empty array for guest mode (localStorage is used client-side)
    return NextResponse.json([]);
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    
    // Return a new conversation object (localStorage handles actual storage)
    const conversation = {
      id,
      title: "New Chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json(conversation);
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
