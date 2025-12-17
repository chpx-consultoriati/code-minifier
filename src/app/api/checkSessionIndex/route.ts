import { NextResponse, NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

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

    const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
    const INDEX_NAME = 'code-repository';

    if (!PINECONE_API_KEY) {
      console.error('PINECONE_API_KEY não configurada');
      return NextResponse.json(
        { success: false, message: 'Configuração de serviço incompleta', indexed: false },
        { status: 500 }
      );
    }

    // Initialize Pinecone client
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME);

    // Try to fetch a vector with the session prefix to check if it exists
    try {
      // Use metadata filtering to check for vectors with this sessionId
      const queryResponse = await index.query({
        vector: Array(1536).fill(0), // Dummy vector
        topK: 1,
        filter: {
          sessionId: { $eq: sessionId }
        },
        includeMetadata: true
      });

      // If we found at least one vector with this sessionId, the session is indexed
      const indexed = queryResponse.matches.length > 0;
      
      return NextResponse.json({
        success: true,
        indexed
      });
    } catch (error) {
      console.error('Error checking session index:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to check session index', indexed: false },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in checkSessionIndex API:', error);
    return NextResponse.json(
      { success: false, message: error.message, indexed: false },
      { status: 500 }
    );
  }
}