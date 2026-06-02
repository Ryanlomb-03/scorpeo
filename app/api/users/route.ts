import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { email, username } = await req.json();

    if (!email || !username) {
      return NextResponse.json({ error: "Email and username required" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, username')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking user:", checkError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // If user exists, update username
    if (existingUser) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ username })
        .eq('email', email);

      if (updateError) {
        console.error("Error updating user:", updateError);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        user: { ...existingUser, username } 
      });
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ email, username })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating user:", insertError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: newUser });

  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });

  } catch (error) {
    console.error("Users API error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
