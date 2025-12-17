/**
 * Utilitário para dividir código em chunks lógicos para indexação vetorial
 */
export interface CodeChunk {
    id: string;
    content: string;
    filePath: string;
    startLine: number;
    endLine: number;
    chunkIndex: number;
}

/**
 * Divide um arquivo de código em chunks lógicos, preservando estrutura
 * @param filePath Caminho do arquivo
 * @param content Conteúdo do arquivo
 * @param maxCharacters Tamanho máximo de cada chunk (aprox. 2000 caracteres ≈ 500 tokens)
 */
export function chunkCodeFile(
    filePath: string,
    content: string,
    maxCharacters: number = 2000
): CodeChunk[] {
    // Dividir o arquivo em linhas
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];

    let currentChunk = '';
    let currentStartLine = 0;
    let lineIndex = 0;
    let chunkIndex = 0;

    // Função para detectar possíveis limites lógicos (funções, classes, etc.)
    const isLogicalBreakpoint = (line: string): boolean => {
        const patterns = [
            /^function\s+\w+/, // Declaração de função
            /^class\s+\w+/, // Declaração de classe
            /^const\s+\w+\s*=\s*function/, // Função anônima atribuída
            /^const\s+\w+\s*=\s*\(.*?\)\s*=>/, // Arrow function
            /^\/\/\s*-----/, // Comentário de separação de arquivo
            /^import\s+/, // Declaração de import
            /^export\s+/, // Declaração de export
            /^}\s*$/, // Fechamento de bloco
            /^\s*$/ // Linha em branco
        ];

        return patterns.some(pattern => pattern.test(line));
    };

    // Função para finalizar e salvar o chunk atual
    const saveCurrentChunk = () => {
        if (currentChunk.trim()) {
            chunks.push({
                id: `${filePath}::${chunkIndex}`,
                content: currentChunk.trim(),
                filePath,
                startLine: currentStartLine,
                endLine: lineIndex - 1,
                chunkIndex
            });

            chunkIndex++;
            currentChunk = '';
            currentStartLine = lineIndex;
        }
    };

    // Percorrer todas as linhas do arquivo
    while (lineIndex < lines.length) {
        const line = lines[lineIndex];

        // Se adicionar esta linha ultrapassar o tamanho máximo e houver um ponto lógico para quebrar
        if (
            currentChunk.length + line.length > maxCharacters &&
            currentChunk.length > 0 &&
            isLogicalBreakpoint(line)
        ) {
            saveCurrentChunk();
        }

        // Adicionar a linha atual ao chunk
        currentChunk += line + '\n';

        // Se o tamanho atual já está no limite, salvar mesmo sem um breakpoint ideal
        if (currentChunk.length >= maxCharacters) {
            saveCurrentChunk();
        }

        lineIndex++;
    }

    // Salvar o último chunk (se houver)
    if (currentChunk.trim()) {
        saveCurrentChunk();
    }

    return chunks;
}