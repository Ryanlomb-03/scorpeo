import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    // Return success (localStorage handles actual updates)
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Return success (localStorage handles actual deletion)
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
