// ----- src/app/api/gpt/route.ts -----
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { model, messages, temperature = 0.7, max_tokens = 1500, stream = false } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { message: 'Mensagens não fornecidas ou formato inválido' },
        { status: 400 }
      );
    }

    // Verificar se a API key está configurada
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: 'API key não configurada. Configure a variável de ambiente OPENAI_API_KEY.' },
        { status: 500 }
      );
    }

    // Mapear o modelo para um modelo disponível na API da OpenAI
    // GPT-4.1 não é um modelo oficial, então usamos o gpt-4o ou gpt-4-turbo
    const modelMap: Record<string, string> = {
      'gpt-4.1': 'gpt-4o', // Substitua pelo modelo mais recente disponível em sua conta
      'gpt-4': 'gpt-4-turbo',
    };
    
    const actualModel = modelMap[model] || model;

    // Fazer a chamada para a API da OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: actualModel,
        messages,
        temperature,
        max_tokens,
        stream
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erro na resposta da OpenAI:', errorData);
      return NextResponse.json(
        { 
          message: 'Erro ao conectar com a API da OpenAI', 
          details: errorData 
        },
        { status: response.status }
      );
    }

    if (stream) {
      // Retornar resposta em stream
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error: any) {
    console.error('Erro na API do GPT:', error);
    return NextResponse.json(
      { message: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}