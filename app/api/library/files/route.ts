import { NextResponse } from "next/server";
import supabase from "@/lib/db";
import zlib from "zlib";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Fetch files from database using Supabase
    const { data, error } = await supabase
      .from('library')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch files from database',
        details: error.message
      }, { status: 500 });
    }

    const files = (data || []).map((row: any) => {
      // Decompress file data for display
      let displaySize = row.file_size;
      let fileData = null;
      const isTextFile = row.file_type.includes('text') || row.file_name.endsWith('.md') || row.file_name.endsWith('.txt');
      
      if (row.file_data) {
        try {
          // Robust Buffer conversion
          let buffer: Buffer;
          const rawData = row.file_data;
          
          if (Buffer.isBuffer(rawData)) {
            buffer = rawData;
          } else if (typeof rawData === 'object' && rawData.type === 'Buffer' && Array.isArray(rawData.data)) {
            buffer = Buffer.from(rawData.data);
          } else if (typeof rawData === 'string') {
            if (rawData.startsWith('{"type":"Buffer"')) {
              buffer = Buffer.from(JSON.parse(rawData).data);
            } else if (rawData.startsWith('\\x')) {
              // Handle hex strings
              const hex = rawData.replace(/^\\x/, '');
              buffer = Buffer.from(hex, 'hex');
            } else {
              buffer = Buffer.from(rawData);
            }
          } else {
            buffer = Buffer.from(rawData);
          }

          if (row.is_compressed) {
            try {
              const decompressed = zlib.inflateSync(buffer);
              displaySize = decompressed.length;
              fileData = isTextFile ? decompressed.toString('utf-8') : decompressed.toString('base64');
            } catch (decompressError) {
              fileData = isTextFile ? buffer.toString('utf-8') : buffer.toString('base64');
            }
          } else {
            fileData = isTextFile ? buffer.toString('utf-8') : buffer.toString('base64');
          }
        } catch (error) {
          console.error('Error processing file data for', row.file_name, ':', error);
        }
      }

      return {
        id: row.id,
        name: row.file_name,
        type: row.file_type,
        size: displaySize,
        originalSize: row.original_file_size,
        mimeType: row.mime_type,
        userId: userId,
        createdAt: row.created_at,
        modifiedAt: row.modified_at,
        isCompressed: row.is_compressed,
        compressionRatio: row.compression_ratio,
        fileData: fileData,
      };
    });

    return NextResponse.json({
      success: true,
      files
    });

  } catch (error) {
    console.error('Fetch files error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { fileId, content } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Convert text to Buffer
    const buffer = Buffer.from(content || '', 'utf-8');

    // Update file in database
    const { error } = await supabase
      .from('library')
      .update({
        file_data: buffer,
        file_size: buffer.length,
        original_file_size: buffer.length,
        is_compressed: false, // Don't compress updates
        modified_at: new Date().toISOString()
      })
      .eq('id', fileId);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Delete file from database using Supabase
    const { error } = await supabase
      .from('library')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ 
        error: 'Failed to delete file from database',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Fetch file from database
    const { data, error } = await supabase
      .from('library')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !data) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch file from database',
        details: error?.message
      }, { status: 500 });
    }

    // Return compressed file data as-is (no decompression)
    let fileData = data.file_data;

    if (!fileData) {
      return NextResponse.json({ error: 'File data not found' }, { status: 404 });
    }

    // Ensure fileData is a Buffer before sending
    if (!(fileData instanceof Buffer)) {
      if (typeof fileData === 'object' && fileData.type === 'Buffer' && Array.isArray(fileData.data)) {
        fileData = Buffer.from(fileData.data);
      } else if (typeof fileData === 'string' && fileData.startsWith('{"type":"Buffer"')) {
        const parsed = JSON.parse(fileData);
        fileData = Buffer.from(parsed.data);
      }
    }

    // Ensure fileData is a Buffer before sending
    if (!(fileData instanceof Buffer) && typeof fileData === 'object' && fileData.type === 'Buffer') {
      fileData = Buffer.from(fileData.data);
    }

    // Return file as downloadable response
    return new NextResponse(fileData, {
      headers: {
        'Content-Type': data.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${data.file_name}"`,
        'Content-Length': fileData.length.toString()
      }
    });

  } catch (error) {
    console.error('Download file error:', error);
    return NextResponse.json({ 
      error: 'Failed to download file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
