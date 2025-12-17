// ----- src/services/codeAssistant.ts -----
import { OpenAI } from 'openai';
import { queryRelevantCode } from './vectorDb';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * Responde a uma pergunta sobre código usando RAG
 * @param question Pergunta do usuário
 * @returns Resposta do assistente
 */
export async function answerCodeQuestion(question: string): Promise<string> {
    try {
        // 1. Buscar chunks relevantes no banco vetorial
        const relevantChunks = await queryRelevantCode(question, 5);

        if (relevantChunks.length === 0) {
            return "Não encontrei nenhum código relevante para responder sua pergunta. Poderia reformular ou fornecer mais detalhes?";
        }

        // 2. Formatar os chunks relevantes como contexto
        const context = relevantChunks
            .map(chunk => {
                return `-- arquivo: ${chunk.filePath} (linhas ${chunk.startLine}-${chunk.endLine}) --\n\`\`\`\n${chunk.text}\n\`\`\``;
            })
            .join('\n\n');

        // 3. Chamar a API de chat com o contexto e pergunta
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1", // Usar GPT-4o em vez de GPT-4.1 (ainda não disponível)
            messages: [
                {
                    role: "system",
                    content: "Você é um assistente especializado em código que responde a perguntas técnicas com base no código fornecido. Seja detalhado e forneça exemplos quando necessário."
                },
                {
                    role: "system",
                    content: `Aqui estão os trechos relevantes do código:\n\n${context}`
                },
                {
                    role: "user",
                    content: question
                }
            ],
            temperature: 0.2,
            max_tokens: 1500,
            stream: false
        });

        return completion.choices[0].message.content || "Não consegui gerar uma resposta.";
    } catch (error) {
        console.error('Error answering code question:', error);
        return `Erro ao processar sua pergunta: ${error.message}`;
    }
}