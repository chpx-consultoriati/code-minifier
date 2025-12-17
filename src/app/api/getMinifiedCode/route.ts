import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isServer } from '@/lib/platform-utils';

// Verificação de segurança para garantir que o código só execute no servidor
if (!isServer) {
  console.error('ERRO: getMinifiedCode/route.ts deve ser usado apenas no servidor!');
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Determinar o diretório onde os arquivos da sessão são armazenados
    const tempDir = process.env.TEMP_DIR || '/tmp';
    const extractDir = path.join(tempDir, `code-minifier-${sessionId}`);
    
    // Verificar se existe um arquivo de código minificado para esta sessão
    const minifiedFilePath = path.join(extractDir, 'minified-code.txt');
    
    if (!fs.existsSync(minifiedFilePath)) {
      // Se não existir um arquivo específico, vamos procurar todos os arquivos na pasta
      // e concatenar seu conteúdo
      if (!fs.existsSync(extractDir)) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Nenhum código encontrado para a sessão ${sessionId}` 
          },
          { status: 404 }
        );
      }

      // Buscar todos os arquivos na pasta de forma recursiva
      const allFiles = getAllFiles(extractDir);
      
      // Limitar a quantidade de arquivos e seu tamanho para evitar problemas
      const filesToProcess = allFiles.slice(0, 50); // Limite de 50 arquivos
      
      let combinedContent = '';
      for (const file of filesToProcess) {
        try {
          // Verificar o tamanho do arquivo antes de ler
          const stats = fs.statSync(file);
          if (stats.size > 1000000) { // Limitar a 1MB por arquivo
            continue;
          }

          const fileContent = fs.readFileSync(file, 'utf-8');
          const relativePath = path.relative(extractDir, file);
          combinedContent += `// ----- ${relativePath} -----\n${fileContent}\n\n`;
        } catch (err) {
          console.error(`Erro ao ler arquivo ${file}:`, err);
        }
      }
      
      return NextResponse.json({
        success: true,
        content: combinedContent || 'Nenhum conteúdo encontrado',
      });
    }
    
    // Ler o arquivo de código minificado
    const content = fs.readFileSync(minifiedFilePath, 'utf-8');
    
    return NextResponse.json({
      success: true,
      content,
    });
  } catch (error: any) {
    console.error('Error in getMinifiedCode API:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// Função auxiliar para obter todos os arquivos em um diretório e subdiretórios
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      // Verificar se o arquivo é um arquivo de texto
      const ext = path.extname(filePath).toLowerCase();
      const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md', '.txt', '.py', '.java', '.c', '.cpp', '.cs'];
      
      if (textExtensions.includes(ext)) {
        arrayOfFiles.push(filePath);
      }
    }
  });

  return arrayOfFiles;
}