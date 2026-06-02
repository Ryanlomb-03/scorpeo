import { NextResponse } from "next/server";
import zlib from "zlib";
import supabase from "@/lib/db";

// Allowed file types (all except .exe and .apk)
const BLOCKED_EXTENSIONS = ['.exe', '.apk', '.msi', '.dmg', '.deb', '.rpm', '.sh', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check file extension
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (BLOCKED_EXTENSIONS.includes(`.${fileExtension}`)) {
      return NextResponse.json({ 
        error: `File type .${fileExtension} is not allowed for security reasons` 
      }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const originalSize = buffer.length;

    // Get file metadata
    const fileType = file.type || 'application/octet-stream';
    const mimeType = file.type || 'application/octet-stream';

    // Only compress non-text files to keep markdown readable
    const isTextFile = fileType.includes('text') || fileName.endsWith('.md') || fileName.endsWith('.txt');
    const shouldCompress = !isTextFile;
    
    const finalBuffer = shouldCompress ? zlib.deflateSync(buffer) : buffer;
    const finalSize = finalBuffer.length;

    // Calculate compression ratio
    const compressionRatio = (shouldCompress && originalSize > 0) ? ((originalSize - finalSize) / originalSize) * 100 : 0;

    // Save to database using Supabase
    const fileId = crypto.randomUUID();
    const { data, error } = await supabase
      .from('library')
      .insert({
        id: fileId,
        user_id: userId,
        file_name: fileName,
        file_type: fileType,
        file_size: finalSize,
        original_file_size: originalSize,
        file_data: finalBuffer,
        mime_type: mimeType,
        is_compressed: shouldCompress,
        compression_ratio: parseFloat(compressionRatio.toFixed(2))
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ 
        error: 'Failed to save file to database',
        details: error.message
      }, { status: 500 });
    }

    // Return success response with file metadata
    return NextResponse.json({
      success: true,
      file: {
        id: data.id,
        name: fileName,
        type: fileType,
        size: finalSize,
        originalSize: originalSize,
        mimeType: mimeType,
        userId: userId,
        createdAt: data.created_at,
        modifiedAt: data.created_at,
        isCompressed: shouldCompress,
        compressionRatio: compressionRatio.toFixed(2),
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
