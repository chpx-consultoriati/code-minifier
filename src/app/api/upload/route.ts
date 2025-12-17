import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';

// Array para armazenar logs
let debugLogs: string[] = [];

// Função de log personalizada
function log(message: string, ...args: any[]) {
  const logMessage = `[${new Date().toISOString()}] ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`;
  console.log(logMessage);
  debugLogs.push(logMessage);
}

function logError(message: string, error: any) {
  const logMessage = `[${new Date().toISOString()}] ERROR: ${message} - ${error?.message || error}`;
  console.error(logMessage);
  debugLogs.push(logMessage);
  if (error?.stack) {
    debugLogs.push(`Stack: ${error.stack}`);
  }
}

// Função para verificar se um arquivo é de texto
function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.sass', '.less',
    '.html', '.xml', '.svg',
    '.py', '.java', '.cpp', '.c', '.h',
    '.rb', '.php', '.go', '.rs',
    '.yaml', '.yml', '.toml', '.ini',
    '.sh', '.bash', '.env',
  ];
  
  return textExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Função para verificar se um arquivo deve ser ignorado com base em regras .gitignore
function shouldIgnoreFile(filePath: string, gitignoreRules: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  if (path.basename(normalizedPath).startsWith('.') || path.basename(normalizedPath) === '.gitignore') {
    return true;
  }
  
  for (const rule of gitignoreRules) {
    if (rule.startsWith('#') || rule.trim() === '') continue;
    
    const pattern = rule.trim().replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$|^${pattern}/|/${pattern}$|/${pattern}/`);
    
    if (regex.test(normalizedPath)) {
      return true;
    }
  }
  
  return false;
}

// Função para extrair e processar o arquivo ZIP
async function extractAndProcessZip(zipBuffer: Buffer): Promise<any> {
  log('Iniciando extração do ZIP...');
  log('Tamanho do buffer:', zipBuffer.length);
  
  try {
    const sessionId = uuidv4();
    log('Session ID:', sessionId);
    
    const extractDir = path.join(process.env.TEMP_DIR || '/tmp', `code-minifier-${sessionId}`);
    log('Diretório de extração:', extractDir);
    
    await fs.mkdir(extractDir, { recursive: true });
    log('Diretório criado com sucesso');
    
    const zipFilePath = path.join(extractDir, 'upload.zip');
    log('Salvando ZIP em:', zipFilePath);
    
    await fs.writeFile(zipFilePath, zipBuffer);
    log('ZIP salvo com sucesso');
    
    log('Iniciando extração do arquivo...');
    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(extractDir, true);
    log('Extração concluída');
    
    await fs.unlink(zipFilePath);
    log('Arquivo ZIP temporário removido');
    
    log('Processando arquivos .gitignore...');
    const gitignoreRules: string[] = [];
    await processGitignoreFiles(extractDir, gitignoreRules);
    log('Regras .gitignore encontradas:', gitignoreRules.length);
    
    log('Construindo estrutura de arquivos...');
    const fileStructure = await buildFileStructure(extractDir, '', gitignoreRules);
    log('Estrutura de arquivos construída com sucesso');
    
    return {
      sessionId,
      extractDir,
      fileStructure,
    };
  } catch (error: any) {
    logError('Erro ao extrair e processar o ZIP', error);
    throw new Error(`Falha ao processar o arquivo ZIP: ${error.message}`);
  }
}

// Função para processar arquivos .gitignore recursivamente
async function processGitignoreFiles(dir: string, rules: string[]): Promise<void> {
  try {
    log('Processando diretório para .gitignore:', dir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await processGitignoreFiles(fullPath, rules);
      } else if (entry.name === '.gitignore') {
        log('.gitignore encontrado em:', fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n').map(line => line.trim());
        rules.push(...lines);
      }
    }
  } catch (error: any) {
    logError('Erro ao processar arquivos .gitignore', error);
  }
}

// Função para construir a estrutura de arquivos recursivamente
async function buildFileStructure(baseDir: string, relativePath: string, gitignoreRules: string[]): Promise<any> {
  log('Construindo estrutura para:', relativePath || '/');
  
  try {
    const currentDir = path.join(baseDir, relativePath);
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    const structure: any = {
      name: path.basename(relativePath) || path.basename(baseDir),
      path: relativePath || '/',
      type: 'directory',
      children: [],
    };
    
    log('Total de entradas no diretório:', entries.length);
    
    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      log('Processando:', entryRelativePath);
      
      if (shouldIgnoreFile(entryRelativePath, gitignoreRules)) {
        log('Arquivo ignorado:', entryRelativePath);
        continue;
      }
      
      if (entry.isDirectory()) {
        log('Processando subdiretório:', entryRelativePath);
        const subStructure = await buildFileStructure(baseDir, entryRelativePath, gitignoreRules);
        structure.children.push(subStructure);
      } else {
        try {
          const fullPath = path.join(baseDir, entryRelativePath);
          log('Obtendo stats do arquivo:', fullPath);
          const stats = await fs.stat(fullPath);
          
          let fileContent = '';
          let tokenCount = 0;
          
          if (isTextFile(entry.name)) {
            log('Arquivo de texto detectado:', entry.name);
            if (stats.size < 1024 * 1024 * 5) { // Limite de 5MB
              try {
                log('Lendo conteúdo do arquivo:', entry.name);
                fileContent = await fs.readFile(fullPath, 'utf-8');
                tokenCount = fileContent.split(/\s+/).length;
                log('Arquivo lido com sucesso. Tokens:', tokenCount);
              } catch (readError: any) {
                logError('Não foi possível ler o arquivo como texto: ' + entryRelativePath, readError);
              }
            } else {
              log('Arquivo muito grande, ignorado:', entryRelativePath, stats.size);
            }
          } else {
            log('Arquivo binário detectado:', entry.name);
          }
          
          structure.children.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            size: stats.size,
            tokenCount,
            ignored: false,
            isText: isTextFile(entry.name),
          });
          
          log('Arquivo adicionado à estrutura:', entry.name);
        } catch (error: any) {
          logError('Erro ao processar arquivo: ' + entryRelativePath, error);
          
          structure.children.push({
            name: entry.name,
            path: entryRelativePath,
            type: 'file',
            size: 0,
            tokenCount: 0,
            ignored: false,
            error: `Erro ao ler o arquivo: ${error.message}`,
          });
        }
      }
    }
    
    log('Estrutura completa para:', relativePath || '/');
    return structure;
  } catch (error: any) {
    logError('Erro ao construir estrutura para: ' + relativePath, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  // Limpa os logs anteriores
  debugLogs = [];
  
  log('===== INÍCIO DA REQUISIÇÃO =====');
  log('Método:', req.method);
  log('URL:', req.url);
  
  try {
    log('Lendo FormData...');
    const formData = await req.formData();
    log('FormData lido com sucesso');
    
    const zipFile = formData.get('zipFile') as File;
    
    if (!zipFile) {
      logError('Nenhum arquivo ZIP foi enviado', new Error('No file'));
      return NextResponse.json(
        { 
          success: false,
          message: 'Nenhum arquivo ZIP foi enviado',
          logs: debugLogs 
        },
        { status: 400 }
      );
    }
    
    log('Arquivo recebido:', zipFile.name);
    log('Tipo:', zipFile.type);
    log('Tamanho:', zipFile.size);
    
    // Validar tipo de arquivo
    if (!zipFile.name.endsWith('.zip') && !zipFile.type.includes('zip')) {
      logError('Arquivo não é um ZIP', new Error('Invalid file type'));
      return NextResponse.json(
        { 
          success: false,
          message: 'O arquivo deve ser um ZIP',
          logs: debugLogs 
        },
        { status: 400 }
      );
    }
    
    log('Convertendo arquivo para Buffer...');
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    log('Buffer criado com sucesso');
    
    log('Iniciando processamento do ZIP...');
    const { sessionId, extractDir, fileStructure } = await extractAndProcessZip(zipBuffer);
    log('Processamento concluído com sucesso');
    
    log('===== REQUISIÇÃO CONCLUÍDA COM SUCESSO =====');
    
    return NextResponse.json({
      success: true,
      sessionId,
      extractDir,
      fileStructure,
      logs: debugLogs,
    });
  } catch (error: any) {
    logError('===== ERRO NO PROCESSAMENTO =====', error);
    logError('Tipo de erro:', error.constructor);
    
    return NextResponse.json(
      { 
        success: false,
        message: error.message || 'Erro interno do servidor',
        errorType: error.constructor.name,
        stack: error.stack,
        logs: debugLogs,
      },
      { status: 500 }
    );
  }
}
