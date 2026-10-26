import { NextRequest, NextResponse } from 'next/server';
import { executeCode, isExecutionServiceAvailable } from '@/lib/codeExecution';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { language, sourceCode, stdin, args } = body;

    // Validate required fields
    if (!language || !sourceCode) {
      return NextResponse.json(
        { error: 'Missing required fields: language and sourceCode' },
        { status: 400 }
      );
    }

    // Check if execution service is available
    const isAvailable = await isExecutionServiceAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Code execution service is currently unavailable' },
        { status: 503 }
      );
    }

    // Execute the code
    const result = await executeCode({
      language,
      sourceCode,
      stdin: stdin || '',
      args: args || [],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Execution API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute code', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAvailable = await isExecutionServiceAvailable();
    return NextResponse.json({ available: isAvailable });
  } catch (error) {
    return NextResponse.json({ available: false, error: 'Failed to check availability' });
  }
}
