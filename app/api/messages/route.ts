import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://igofnasquyrrkrwvtqsq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnb2ZuYXNxdXlycmtyd3Z0cXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjAwNjQsImV4cCI6MjA5NTczNjA2NH0.bHAyDFqbD087z2fq4SfkLBCKOxRGwjGfOKaV-CCDY1w";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    const limit = request.nextUrl.searchParams.get("limit") || "100";
    
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(parseInt(limit));

    if (error) {
      console.error("Supabase GET messages error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(messages);
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
    
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        id,
        conversation_id: conversationId,
        role,
        content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase POST messages error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update conversation's updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json(message);
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
