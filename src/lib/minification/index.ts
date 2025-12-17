// Este arquivo só deve ser importado pelo lado do servidor
import { isServer } from '../platform-utils';

// Verificação de segurança para garantir que o código só execute no servidor
if (!isServer) {
  console.error('ERRO: minification/index.ts deve ser usado apenas no servidor!');
}

// Importações seguras para o servidor
import path from 'path';
import { fallbackMinifyFile } from './fallback-minifier';

export interface MinifyResult {
  filePath: string;
  content: string;
  originalSize: number;
  minifiedSize: number;
}

export interface MinifyBatchResult {
  content: string;
  originalSize: number;
  minifiedSize: number;
  files: { path: string; originalSize: number; minifiedSize: number }[];
}

const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.html', '.xhtml', '.css', '.json', '.md', '.txt'
];

export function isFileSupported(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export async function minifyFiles(
  filePaths: string[],
  baseDir: string
): Promise<MinifyBatchResult> {
  // Usar diretamente fallbackMinifyFile
  const minifyFileFn = fallbackMinifyFile;

  let totalOrig = 0;
  let totalMin = 0;
  let unified = '';
  const files: MinifyBatchResult['files'] = [];

  const supportedFiles = filePaths.filter(isFileSupported);
  console.log(`Processing ${supportedFiles.length} supported files out of ${filePaths.length} total files`);

  for (const fp of supportedFiles) {
    try {
      const res = await minifyFileFn(fp, baseDir);
      if (!res) continue;

      unified += `// ----- ${res.filePath} -----\n${res.content}\n\n`;
      totalOrig += res.originalSize;
      totalMin += res.minifiedSize;
      files.push({
        path: res.filePath,
        originalSize: res.originalSize,
        minifiedSize: res.minifiedSize
      });
    } catch (err) {
      console.error(`Error processing ${fp}:`, err);
    }
  }

  return {
    content: unified.trim(),
    originalSize: totalOrig,
    minifiedSize: totalMin,
    files,
  };
}

// Exportar apenas o que é seguro usar em ambientes cliente/servidor
export default {
  minifyFiles,
  isFileSupported
};
