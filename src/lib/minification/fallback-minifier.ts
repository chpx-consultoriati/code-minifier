// Este arquivo só deve ser importado pelo lado do servidor
import fs from 'fs';
import path from 'path';
import { isServer } from '../platform-utils';

// Verificação de segurança para garantir que o código só execute no servidor
if (!isServer) {
  console.error('ERRO: fallback-minifier.ts deve ser usado apenas no servidor!');
}

type Lang = 'js' | 'py' | 'java' | 'html' | 'css' | 'text';

const stripRegexes: Record<Lang, RegExp[]> = {
  js: [
    /\/\/.*?$/gm,
    /\/\*[\s\S]*?\*\//g,
    /^\s*import\s+.*?;\s*$/gm,
  ],
  py: [
    /#.*?$/gm,
    /'''[\s\S]*?'''/gm,
    /"""[\s\S]*?"""/gm,
    /^\s*from\s+.*?import.*?$/gm,
    /^\s*import\s+.*?$/gm,
  ],
  java: [
    /\/\/.*?$/gm,
    /\/\*[\s\S]*?\*\//g,
    /\/\*\*[\s\S]*?\*\//g,
    /^\s*package\s+.*?;\s*$/gm,
    /^\s*import\s+.*?;\s*$/gm,
  ],
  html: [
    /<!--[\s\S]*?-->/g,
    /^\s*\n/gm,
  ],
  css: [
    /\/\*[\s\S]*?\*\//g,
    /^\s*\n/gm,
  ],
  text: [
    /^\s*\n/gm,
  ]
};

const extensionMap: Record<string, Lang> = {
  '.js': 'js',
  '.jsx': 'js',
  '.ts': 'js',
  '.tsx': 'js',
  '.py': 'py',
  '.java': 'java',
  '.cs': 'java',
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  '.css': 'css',
  '.md': 'text',
  '.txt': 'text',
  '.json': 'text',
};

const BINARY_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.svg',
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mov',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.bin', '.dat', '.db', '.sqlite', '.class'
];

export function isMinifiableFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.includes(ext)) {
    return false;
  }
  return ext in extensionMap;
}

export async function fallbackMinifyFile(
  filePath: string,
  baseDir: string
): Promise<{
  filePath: string;
  content: string;
  originalSize: number;
  minifiedSize: number;
} | null> {
  if (!isMinifiableFile(filePath)) {
    console.log(`Skipping unsupported file: ${filePath}`);
    return null;
  }

  const fullPath = path.join(baseDir, filePath);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(fullPath);
  } catch (error) {
    console.error(`Cannot stat file ${fullPath}:`, error);
    return null;
  }

  if (!stat.isFile()) {
    console.log(`Not a file: ${fullPath}`);
    return null;
  }

  let content: string;
  try {
    content = await fs.promises.readFile(fullPath, 'utf-8');
  } catch (error) {
    console.error(`Cannot read file ${fullPath}:`, error);
    return null;
  }

  const originalSize = content.length;
  const ext = path.extname(filePath).toLowerCase();
  const lang = extensionMap[ext] || 'text';

  if (ext === '.json') {
    try {
      const parsed = JSON.parse(content);
      const minified = JSON.stringify(parsed);
      return {
        filePath,
        content: minified,
        originalSize,
        minifiedSize: minified.length,
      };
    } catch {
      return {
        filePath,
        content,
        originalSize,
        minifiedSize: originalSize,
      };
    }
  }

  let minified = content;
  for (const rx of stripRegexes[lang]) {
    minified = minified.replace(rx, '');
  }

  if (['js', 'java'].includes(lang)) {
    minified = minified
      .replace(/\s+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();
  } else if (lang === 'py') {
    minified = minified
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  } else if (['html', 'css'].includes(lang)) {
    minified = minified
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .trim();
  }

  return {
    filePath,
    content: minified,
    originalSize,
    minifiedSize: minified.length,
  };
}

export async function minifyFiles(
  filePaths: string[],
  baseDir: string
): Promise<{
  content: string;
  originalSize: number;
  minifiedSize: number;
  files: { path: string; originalSize: number; minifiedSize: number }[];
}> {
  let totalOrig = 0;
  let totalMin = 0;
  let unified = '';
  const details: { path: string; originalSize: number; minifiedSize: number }[] = [];

  const supportedFiles = filePaths.filter(isMinifiableFile);
  for (const fp of supportedFiles) {
    const res = await fallbackMinifyFile(fp, baseDir);
    if (!res) continue;

    unified += `// ----- ${res.filePath} -----\n${res.content}\n\n`;
    totalOrig += res.originalSize;
    totalMin += res.minifiedSize;
    details.push({
      path: res.filePath,
      originalSize: res.originalSize,
      minifiedSize: res.minifiedSize
    });
  }

  return {
    content: unified.trim(),
    originalSize: totalOrig,
    minifiedSize: totalMin,
    files: details,
  };
}

export default {
  fallbackMinifyFile,
  minifyFiles,
  isMinifiableFile
};
