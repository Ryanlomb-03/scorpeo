import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/db";

// GET user's reaction for a specific message
export async function GET(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");
    const userId = request.headers.get("x-user-id");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: reaction, error } = await supabase
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Supabase GET reaction error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reaction: reaction || null });
  } catch (err) {
    console.error("GET /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST to create or remove a reaction
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, reactionType } = await request.json();
    
    if (!messageId || !reactionType || !['like', 'dislike'].includes(reactionType)) {
      return NextResponse.json({ error: "Missing required fields or invalid reaction type" }, { status: 400 });
    }

    // Check if reaction already exists
    const { data: existingReaction, error: checkError } = await supabase
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Supabase check reaction error:", checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingReaction) {
      // If same reaction, remove it (toggle off)
      if (existingReaction.reaction_type === reactionType) {
        const { error: deleteError } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId);

        if (deleteError) {
          console.error("Supabase delete reaction error:", deleteError);
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ reaction: null, action: "removed" });
      } else {
        // Different reaction type selected - this shouldn't happen with new UI
        // but handle it by deleting old and creating new
        const { error: deleteError } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId);

        if (deleteError) {
          console.error("Supabase delete reaction error:", deleteError);
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        const { data, error: insertError } = await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: userId,
            reaction_type: reactionType
          })
          .select()
          .single();

        if (insertError) {
          console.error("Supabase insert reaction error:", insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ reaction: data, action: "created" });
      }
    } else {
      // Create new reaction
      const { data, error: insertError } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction_type: reactionType
        })
        .select()
        .single();

      if (insertError) {
        console.error("Supabase insert reaction error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ reaction: data, action: "created" });
    }
  } catch (err) {
    console.error("POST /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE to remove a reaction
export async function DELETE(request: NextRequest) {
  try {
    const messageId = request.nextUrl.searchParams.get("messageId");
    const userId = request.headers.get("x-user-id");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase delete reaction error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/reactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
