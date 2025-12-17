import { NextResponse, NextRequest } from 'next/server';
import { initVectorDB, ingestFile } from '@/app/services/vectorDb';

let dbInitialized = false;

export async function POST(req: NextRequest) {
  try {
    console.log('Iniciando processamento de indexação de código');
    
    if (!dbInitialized) {
      console.log('Inicializando banco de dados vetorial...');
      try {
        await initVectorDB();
        dbInitialized = true;
        console.log('Banco de dados vetorial inicializado com sucesso');
      } catch (dbError) {
        console.error('Erro ao inicializar o banco de dados vetorial:', dbError);
        return NextResponse.json(
          { 
            success: false, 
            message: `Erro ao inicializar o banco de dados: ${dbError.message}`,
            details: dbError 
          }, 
          { status: 500 }
        );
      }
    }

    const { files, sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!files || !Array.isArray(files)) {
      console.error('Requisição inválida: files não é um array');
      return NextResponse.json(
        { success: false, message: 'Files array is required' },
        { status: 400 }
      );
    }

    console.log(`Processando ${files.length} arquivos para indexação da sessão ${sessionId}`);
    
    const results = await Promise.all(
      files.map(async (file: { path: string, content: string }) => {
        try {
          if (!file.content || typeof file.content !== 'string' || file.content.trim().length === 0) {
            console.warn(`Arquivo ${file.path} sem conteúdo válido`);
            return { 
              path: file.path, 
              success: false, 
              error: 'Conteúdo vazio ou inválido' 
            };
          }

          console.log(`Processando arquivo: ${file.path} (${file.content.length} bytes)`);
          await ingestFile(file.path, file.content, sessionId);
          return { path: file.path, success: true };
        } catch (error) {
          console.error(`Erro detalhado ao processar arquivo ${file.path}:`, error);
          return { 
            path: file.path, 
            success: false, 
            error: error.message || 'Erro desconhecido ao processar arquivo' 
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Indexação concluída: ${successCount} de ${files.length} arquivos processados com sucesso`);
    
    if (successCount === 0 && files.length > 0) {
      const errors = results.map(r => `${r.path}: ${r.error}`).join('; ');
      return NextResponse.json(
        { success: false, message: `Nenhum arquivo foi indexado com sucesso. Erros: ${errors}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} files, ${successCount} successful`,
      results
    });
  } catch (error) {
    console.error('Erro crítico na API de indexação de código:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro interno do servidor',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}