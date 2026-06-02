import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://igofnasquyrrkrwvtqsq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnb2ZuYXNxdXlycmtyd3Z0cXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjAwNjQsImV4cCI6MjA5NTczNjA2NH0.bHAyDFqbD087z2fq4SfkLBCKOxRGwjGfOKaV-CCDY1w";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.is_pinned !== undefined) updateData.is_pinned = body.is_pinned;

    const { error } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Supabase PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
    const userId = request.headers.get("x-user-id");
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete messages first
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", id);

    // Delete conversation
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
