import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { CodeChunk, chunkCodeFile } from '../utils/codeChunker';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const INDEX_NAME = 'code-repository';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

export async function initVectorDB() {
  if (!PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY não está definida nas variáveis de ambiente');
  }
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não está definida nas variáveis de ambiente');
  }

  try {
    console.log('Conectando ao Pinecone...');
    const indexList = await pinecone.listIndexes();
    console.log('Índices disponíveis:', indexList);

    const indexExists = indexList.indexes
      ? indexList.indexes.some((idx: any) => idx.name === INDEX_NAME)
      : Object.keys(indexList).includes(INDEX_NAME);

    if (!indexExists) {
      console.log(`Criando índice ${INDEX_NAME}...`);
      try {
        await pinecone.createIndex({
          name: INDEX_NAME,
          dimension: 1536,
          metric: 'cosine'
        });
        console.log(`Índice ${INDEX_NAME} criado com sucesso`);
      } catch (createError) {
        console.error(`Erro ao criar índice ${INDEX_NAME}:`, createError);
        const updatedList = await pinecone.listIndexes();
        const indexNowExists = updatedList.indexes
          ? updatedList.indexes.some((idx: any) => idx.name === INDEX_NAME)
          : Object.keys(updatedList).includes(INDEX_NAME);

        if (!indexNowExists) {
          throw createError;
        } else {
          console.log(`Índice ${INDEX_NAME} já existe, prosseguindo...`);
        }
      }
    } else {
      console.log(`Índice ${INDEX_NAME} já existe`);
    }
    return true;
  } catch (error) {
    console.error('Erro detalhado ao inicializar o Pinecone:', error);
    throw new Error(`Falha ao conectar ao banco de dados vetorial: ${error.message}`);
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Erro ao gerar embedding:', error);
    throw error;
  }
}

export async function ingestFile(
  filePath: string,
  content: string,
  sessionId: string
): Promise<void> {
  try {
    const chunks = chunkCodeFile(filePath, content);
    console.log(`Chunked ${filePath} into ${chunks.length} parts`);

    const vectors = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await generateEmbedding(chunk.content);
        return {
          id: `${sessionId}::${chunk.id}`,
          values: embedding,
          metadata: {
            sessionId,
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkIndex: chunk.chunkIndex,
            text: chunk.content
          }
        };
      })
    );

    const index = pinecone.index(INDEX_NAME);
    try {
      const upsertResponse = await index.upsert(vectors);
      console.log('Resposta do upsert:', upsertResponse);
    } catch (upsertError) {
      console.error('Erro no upsert:', upsertError);
      throw new Error(`Falha ao indexar vetores: ${upsertError.message}`);
    }

    console.log(`Successfully indexed ${filePath} with ${vectors.length} vectors for session ${sessionId}`);
  } catch (error) {
    console.error(`Error ingesting file ${filePath}:`, error);
    throw error;
  }
}

export async function queryRelevantCode(
  question: string,
  sessionId: string,
  topK: number = 5
): Promise<any[]> {
  try {
    const questionEmbedding = await generateEmbedding(question);
    const index = pinecone.index(INDEX_NAME);
    
    const queryResponse = await index.query({
      vector: questionEmbedding,
      topK,
      includeMetadata: true,
      filter: {
        sessionId: { $eq: sessionId }
      }
    });

    return queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      filePath: match.metadata.filePath,
      startLine: match.metadata.startLine,
      endLine: match.metadata.endLine,
      text: match.metadata.text
    }));
  } catch (error) {
    console.error('Error querying code:', error);
    throw error;
  }
}