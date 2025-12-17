// ----- src/components/GPTAnalysis/index.tsx -----
'use client';

import React, { useState, useCallback } from 'react';
import { Box, Typography, Button, LinearProgress, Alert, AlertTitle, Paper, TextField, Divider, CircularProgress } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';

interface GPTAnalysisProps {
  code: string;
  isMinified: boolean;
}

// Tamanho máximo de cada chunk em caracteres
const CHUNK_SIZE = 8000;

// Função para dividir o código em chunks de tamanho adequado
function splitIntoChunks(text: string, chunkSize: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  
  return chunks;
}

const GPTAnalysis: React.FC<GPTAnalysisProps> = ({ code, isMinified }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState('');
  const [chunkProgress, setChunkProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1500);
  const [processingChunk, setProcessingChunk] = useState(false);

  // Dividir o código em chunks
  const codeChunks = splitIntoChunks(code);
  
  const handleAnalysis = useCallback(async () => {
    if (!code || code.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    setStreamedContent('');
    setChunkProgress({current: 0, total: codeChunks.length});
    
    try {
      let fullContext = '';
      
      for (let i = 0; i < codeChunks.length; i++) {
        const chunk = codeChunks[i];
        setChunkProgress({current: i + 1, total: codeChunks.length});
        setProcessingChunk(true);
        
        const contextMessage = `Este é o chunk ${i + 1} de ${codeChunks.length} do código minificado.`;
        
        // Construir prompt baseado no contexto atual
        let promptMessage;
        if (i === 0) {
          promptMessage = `Analise o seguinte código minificado. ${contextMessage}\n\n${chunk}`;
        } else {
          promptMessage = `${contextMessage} Continuando da análise anterior. \n\n${chunk}`;
        }
        
        const apiMessages = [
          { role: 'system', content: 'Você é um assistente especializado em análise de código. Analise o código fornecido, identifique padrões, possíveis otimizações e explique o que o código está fazendo. Se o código estiver incompleto, analise apenas o que foi fornecido. Seja conciso e direto.' },
          { role: 'user', content: promptMessage }
        ];
        
        // Se não for o primeiro chunk, adicione o contexto anterior resumido
        if (i > 0 && fullContext.length > 0) {
          apiMessages.push({ 
            role: 'assistant', 
            content: `Análise anterior (resumo): ${fullContext.slice(0, 500)}...`
          });
        }
        
        // Fazer a chamada para a API com streaming
        const response = await fetch('/api/gpt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: apiMessages,
            temperature,
            max_tokens: maxTokens,
            stream: true
          }),
        });
        
        if (!response.ok) {
          let errorText = 'Erro na API';
          try {
            const errorData = await response.json();
            errorText = errorData.message || errorText;
          } catch (e) {
            // Se não conseguir parsear o JSON, usa a mensagem genérica
          }
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }
        
        if (!response.body) {
          throw new Error('Stream não disponível na resposta');
        }
        
        // Processar a resposta em streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkResponse = '';
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value);
          // Processar texto usando o formato de streaming da OpenAI
          const lines = text.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                chunkResponse += content;
                setStreamedContent(prev => prev + content);
              } catch (e) {
                console.error('Erro ao parsear dados:', e);
              }
            }
          }
        }
        
        // Adicionar a resposta ao contexto completo
        fullContext += chunkResponse;
        setProcessingChunk(false);
        
        // Se houver mais de um chunk, adicione um separador
        if (i < codeChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Breve pausa entre chunks
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro durante a análise');
      console.error('Erro ao processar análise:', err);
    } finally {
      setIsLoading(false);
      setProcessingChunk(false);
    }
  }, [code, codeChunks, temperature, maxTokens]);
  
  const handleSaveAnalysis = () => {
    if (!streamedContent) return;
    
    const blob = new Blob([streamedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analise-gpt.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        borderRadius: 2, 
        mb: 4, 
        backgroundColor: 'background.paper',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Análise GPT-4.1
        </Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Utilize o GPT-4.1 para analisar o código minificado e receber insights. O código será dividido em {codeChunks.length} chunks.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Erro</AlertTitle>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="Temperatura"
          type="number"
          size="small"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          InputProps={{
            inputProps: { min: 0, max: 1, step: 0.1 }
          }}
          sx={{ width: '120px' }}
        />
        <TextField
          label="Max Tokens"
          type="number"
          size="small"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
          InputProps={{
            inputProps: { min: 500, max: 4000, step: 100 }
          }}
          sx={{ width: '120px' }}
        />
      </Box>
      
      <Button
        variant="contained"
        color="secondary"
        startIcon={<AutoFixHighIcon />}
        onClick={handleAnalysis}
        disabled={isLoading || !isMinified || code.length === 0}
        fullWidth
        sx={{ mb: 3 }}
      >
        {isLoading ? 'Analisando...' : 'Analisar com GPT-4.1'}
      </Button>
      
      {isLoading && (
        <Box sx={{ width: '100%', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              Processando chunk {chunkProgress.current} de {chunkProgress.total}
            </Typography>
            {processingChunk && (
              <CircularProgress size={16} sx={{ ml: 1 }} />
            )}
          </Box>
          <LinearProgress 
            variant="determinate"
            value={(chunkProgress.current / chunkProgress.total) * 100}
            sx={{ 
              height: 8, 
              borderRadius: 4,
              backgroundColor: 'rgba(30, 30, 30, 0.5)',
              '& .MuiLinearProgress-bar': { backgroundColor: 'secondary.main' }
            }} 
          />
        </Box>
      )}
      
      {streamedContent && (
        <>
          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Análise do GPT
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveAnalysis}
                disabled={!streamedContent}
              >
                Salvar Análise
              </Button>
            </Box>
            
            <Box 
              sx={{ 
                p: 2,
                backgroundColor: '#1a1a1a',
                color: '#e0e0e0',
                borderRadius: 1,
                maxHeight: '500px',
                overflow: 'auto',
                fontFamily: '"Geist Mono", monospace',
                fontSize: '0.875rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                whiteSpace: 'pre-wrap'
              }}
            >
              {streamedContent || 'Aguardando análise...'}
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default GPTAnalysis;