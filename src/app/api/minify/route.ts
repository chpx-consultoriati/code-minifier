// src/app/api/minify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { minifyFiles, isFileSupported } from '@/lib/minification';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.sessionId || !data.filePaths || !Array.isArray(data.filePaths)) {
      return NextResponse.json(
        { message: 'Dados inválidos. Sessão ou lista de arquivos não fornecidos.' },
        { status: 400 }
      );
    }
    
    const { sessionId, filePaths } = data;
    const extractDir = path.join(process.env.TEMP_DIR || '/tmp', `code-minifier-${sessionId}`);
    
    // Filter out unsupported files
    const supportedFilePaths = filePaths.filter(isFileSupported);
    const unsupportedFilePaths = filePaths.filter(file => !isFileSupported(file));
    
    // If there are unsupported files, log them for debugging
    if (unsupportedFilePaths.length > 0) {
      console.log(`Skipping ${unsupportedFilePaths.length} unsupported files:`, unsupportedFilePaths);
    }
    
    // If no supported files remain, return an error
    if (supportedFilePaths.length === 0) {
      return NextResponse.json(
        { message: 'Nenhum arquivo suportado foi selecionado para minificação.' },
        { status: 400 }
      );
    }
    
    // Process only the supported files
    const result = await minifyFiles(supportedFilePaths, extractDir);
    
    return NextResponse.json({
      success: true,
      content: result.content,
      originalSize: result.originalSize,
      minifiedSize: result.minifiedSize,
      reductionPercentage: ((result.originalSize - result.minifiedSize) / result.originalSize * 100).toFixed(2),
      files: result.files,
      skippedFiles: unsupportedFilePaths.length
    });
    
  } catch (error: any) {
    console.error('Erro na minificação:', error);
    return NextResponse.json(
      { message: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}