import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    // Return empty results (localStorage handles actual search)
    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
