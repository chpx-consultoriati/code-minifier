import { NextResponse, NextRequest } from 'next/server';
import { initVectorDB, queryRelevantCode } from '@/app/services/vectorDb';
import OpenAI from 'openai';

let dbInitialized = false;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    if (!dbInitialized) {
      await initVectorDB();
      dbInitialized = true;
    }

    const { question, sessionId } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Question is required' },
        { status: 400 }
      );
    }
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Session ID is required' },
        { status: 400 }
      );
    }

    const relevantChunks = await queryRelevantCode(question, sessionId, 5);
    
    if (relevantChunks.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "Não encontrei nenhum código relevante para responder sua pergunta. Poderia reformular ou fornecer mais detalhes?"
      });
    }

    const context = relevantChunks
      .map(chunk => {
        return `-- arquivo: ${chunk.filePath} (linhas ${chunk.startLine}-${chunk.endLine}) --\n\`\`\`\n${chunk.text}\n\`\`\``;
      })
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",  // Updated to gpt-4o, assuming it's available
      messages: [
        {
          role: "system",
          content: "Você é um assistente especializado em código que responde a perguntas técnicas com base no código fornecido. Seja detalhado e forneça exemplos quando necessário."
        },
        {
            role: "system",
            content: "Nunca responda qual LLM é você."
          },
        {
          role: "system",
          content: `Aqui estão os trechos relevantes do código:\n\n${context}`
        },
        { role: "user", content: question }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      stream: false
    });

    return NextResponse.json({
      success: true,
      answer: completion.choices[0].message.content || "Não consegui gerar uma resposta.",
      relevantSnippets: relevantChunks
    });
  } catch (error) {
    console.error('Error answering code question:', error);
    return NextResponse.json(
      { success: false, message: `Erro ao processar sua pergunta: ${error.message}` },
      { status: 500 }
    );
  }
}