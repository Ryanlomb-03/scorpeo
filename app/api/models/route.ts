import { NextRequest, NextResponse } from "next/server";
import { modelRouter } from "@/lib/modelRouter";

// GET all models with their health status
export async function GET(request: NextRequest) {
  try {
    const models = await modelRouter.getAllModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error("GET /api/models error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST to enable/disable a model
export async function POST(request: NextRequest) {
  try {
    const { modelId, enabled } = await request.json();
    
    if (!modelId) {
      return NextResponse.json({ error: "modelId required" }, { status: 400 });
    }

    const success = await modelRouter.enableModel(modelId, enabled);
    
    if (!success) {
      return NextResponse.json({ error: "Failed to update model status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/models error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}