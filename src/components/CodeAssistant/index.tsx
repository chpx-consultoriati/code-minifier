// ----- src/components/CodeAssistant/index.tsx -----
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  LinearProgress, 
  Alert, 
  AlertTitle, 
  Paper, 
  TextField, 
  Divider, 
  CircularProgress,
  List,
  ListItem,
  IconButton,
  Chip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import SettingsIcon from '@mui/icons-material/Settings';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CodeAssistantProps {
  minifiedCode?: string; // Opcional, para iniciar o contexto com código minificado
}

// Configuração para chunks de código
const DEFAULT_CHUNK_SIZE = 16000; // Tamanho máximo por chunk em caracteres
const OVERLAP_SIZE = 1000; // Sobreposição entre chunks para manter contexto

/**
 * Divide o código em chunks mantendo a estrutura de arquivos e blocos de código intactos sempre que possível.
 * Implementa sobreposição inteligente para preservar contexto entre chunks.
 */
function splitCodeIntoChunks(text: string, maxChunkSize: number = DEFAULT_CHUNK_SIZE): string[] {
  if (!text || text.length <= maxChunkSize) {
    return [text]; // Se o texto cabe em um único chunk, retorne-o
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  // Função para encontrar um bom ponto de quebra - final de arquivo ou função
  const findBreakPoint = (text: string, startPos: number, endPos: number): number => {
    // Marcadores que indicam bons pontos de quebra, em ordem de preferência
    const breakMarkers = [
      '\n\n// -----', // Marcador de início de arquivo
      '\n\n/**', // Início de comentário de documentação
      '\n\nfunction ', // Início de função
      '\n\nclass ', // Início de classe
      '\n\n', // Quebra de linha dupla
      '\n' // Quebra de linha simples
    ];
    
    for (const marker of breakMarkers) {
      // Procura pela última ocorrência do marcador dentro do intervalo
      const lastIndex = text.lastIndexOf(marker, endPos);
      if (lastIndex > startPos) {
        return lastIndex;
      }
    }
    
    // Se nenhum bom ponto for encontrado, use o tamanho máximo
    return endPos;
  };

  while (currentPosition < text.length) {
    // Calculamos a posição final potencial para este chunk
    let endPosition = Math.min(currentPosition + maxChunkSize, text.length);
    
    // Se não estamos no final do texto, precisamos encontrar um bom ponto de quebra
    if (endPosition < text.length) {
      endPosition = findBreakPoint(text, currentPosition, endPosition);
    }
    
    // Extrair o chunk atual
    const chunk = text.substring(currentPosition, endPosition);
    chunks.push(chunk);
    
    // Avançar para a próxima posição, descontando a sobreposição
    // Mas garantindo que avançamos pelo menos 1/3 do tamanho do chunk para não ficar estagnado
    const minAdvance = Math.max(maxChunkSize / 3, 100);
    currentPosition = Math.max(endPosition - OVERLAP_SIZE, currentPosition + minAdvance);
  }
  
  return chunks;
}

const CodeAssistant: React.FC<CodeAssistantProps> = ({ minifiedCode }) => {
  // Estados principais
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'system', 
      content: 'Você é um assistente especializado em código. Ajude a analisar, explicar e melhorar o código fornecido. Seja específico e detalhado, fornecendo exemplos sempre que possível. Quando sugerir melhorias, explique por que elas são benéficas.' 
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeContext, setCodeContext] = useState<string>('');
  
  // Estados de configuração e progresso
  const [contextEstablished, setContextEstablished] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1500);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [showSettings, setShowSettings] = useState(false);
  
  // Referências para UI
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Effect para rolar para a última mensagem quando há mensagens novas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Effect para definir o código minificado como contexto inicial, se fornecido
  useEffect(() => {
    if (minifiedCode && !contextEstablished && codeContext === '') {
      setCodeContext(minifiedCode);
    }
  }, [minifiedCode, contextEstablished, codeContext]);

  /**
   * Envia todos os chunks de código para o modelo para estabelecer o contexto
   * Garante que todos os chunks fiquem acumulados no estado de mensagens
   */
  const handleEstablishContext = async () => {
    if (!codeContext) {
      setError('Não há código para estabelecer contexto.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Dividir o código em chunks
      const codeChunks = splitCodeIntoChunks(codeContext, chunkSize);
      setChunkProgress({current: 0, total: codeChunks.length});
      
      // Adicionar mensagem inicial do usuário indicando o estabelecimento de contexto
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: `Vou enviar ${codeChunks.length} chunks do meu código-fonte para análise. Por favor, aguarde até que todo o código seja enviado antes de responder com análises detalhadas.`
        }
      ]);
      
      // Processar cada chunk de código sequencialmente
      for (let i = 0; i < codeChunks.length; i++) {
        const chunk = codeChunks[i];
        setChunkProgress({current: i + 1, total: codeChunks.length});
        
        // CORRETO: Adicionar cada chunk como uma nova mensagem no estado
        // usando o callback para garantir o estado mais recente
        setMessages(prev => [
          ...prev,
          {
            role: 'user',
            content: `[CONTEXTO DE CÓDIGO - PARTE ${i + 1}/${codeChunks.length}]\n\n${chunk}`
          }
        ]);
        
        // Importante: Aguardar a atualização do estado antes de continuar
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Obter o estado mais recente de mensagens para a chamada à API
        // Não podemos usar o closure de messages aqui, pois ele estará desatualizado
        const currentMessages = [...messages, {
          role: 'user',
          content: `[CONTEXTO DE CÓDIGO - PARTE ${i + 1}/${codeChunks.length}]\n\n${chunk}`
        }];
        
        // Enviar toda a thread de mensagens incluindo o chunk atual
        const response = await fetch('/api/gpt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: currentMessages, // Incluir todas as mensagens até agora
            temperature,
            max_tokens: 150, // Resposta curta para confirmação
            stream: true
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: Falha ao estabelecer contexto`);
        }
        
        if (!response.body) {
          throw new Error('Stream não disponível na resposta');
        }
        
        // Processar a resposta em streaming
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let chunkResponse = '';
        
        // Adicionar mensagem vazia do assistente que será atualizada
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                chunkResponse += content;
                
                // Atualizar a mensagem do assistente em tempo real
                setMessages(prevMsgs => {
                  const updated = [...prevMsgs];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: chunkResponse
                  };
                  return updated;
                });
              } catch (e) {
                console.error('Erro ao parsear dados:', e);
              }
            }
          }
        }
      }
      
      // Após todos os chunks, solicitar uma confirmação final
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: 'Todo o código foi enviado. Por favor, confirme que você recebeu todos os chunks e está pronto para responder perguntas sobre o código.'
        }
      ]);
      
      // Importante: Aguardar a atualização do estado antes de continuar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Obter todas as mensagens atualizadas para a chamada final à API
      const finalMessages = [...messages, {
        role: 'user',
        content: 'Todo o código foi enviado. Por favor, confirme que você recebeu todos os chunks e está pronto para responder perguntas sobre o código.'
      }];
      
      // Fazer a chamada final para a API
      const finalResponse = await fetch('/api/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: finalMessages,
          temperature,
          max_tokens: 300,
          stream: true
        }),
      });
      
      if (!finalResponse.ok) {
        throw new Error(`Erro ${finalResponse.status}: Falha ao estabelecer contexto`);
      }
      
      if (!finalResponse.body) {
        throw new Error('Stream não disponível na resposta');
      }
      
      // Processar a resposta em streaming
      const finalReader = finalResponse.body.getReader();
      const finalDecoder = new TextDecoder();
      let finalResponseText = '';
      
      // Adicionar mensagem vazia do assistente que será atualizada
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      while (true) {
        const { value, done } = await finalReader.read();
        if (done) break;
        
        const text = finalDecoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              finalResponseText += content;
              
              // Atualizar a mensagem do assistente em tempo real
              setMessages(prevMsgs => {
                const updated = [...prevMsgs];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: finalResponseText
                };
                return updated;
              });
            } catch (e) {
              console.error('Erro ao parsear dados:', e);
            }
          }
        }
      }
      
      // Contexto estabelecido com sucesso
      setContextEstablished(true);
      
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao estabelecer o contexto');
      console.error('Erro ao processar o contexto:', err);
      
      // Adicionar mensagem de erro
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Erro ao estabelecer contexto: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Envia uma mensagem do usuário para o modelo
   * Toda a conversa e contexto são mantidos
   */
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const userMessage = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Adicionar mensagem do usuário
      // Importante: Usar o callback para garantir o estado mais recente
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage }
      ]);
      
      // Aguardar a atualização do estado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Obter o estado mais recente de mensagens para a chamada à API
      const currentMessages = [...messages, { role: 'user', content: userMessage }];
      
      // Fazer a chamada para a API com streaming
      const response = await fetch('/api/gpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: currentMessages, // Usando o estado atualizado
          temperature,
          max_tokens: maxTokens,
          stream: true
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Falha ao obter resposta`);
      }
      
      if (!response.body) {
        throw new Error('Stream não disponível na resposta');
      }
      
      // Processar a resposta em streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      
      // Adicionar mensagem vazia do assistente que será atualizada
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              assistantResponse += content;
              
              // Atualizar a mensagem do assistente em tempo real
              setMessages(prevMsgs => {
                const updated = [...prevMsgs];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantResponse
                };
                return updated;
              });
            } catch (e) {
              console.error('Erro ao parsear dados:', e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar a mensagem');
      console.error('Erro ao processar mensagem:', err);
      
      // Atualizar a última mensagem com o erro
      setMessages(prevMsgs => {
        const updated = [...prevMsgs];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Erro: ${err.message}`
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    // Manter apenas a mensagem de sistema inicial
    setMessages([messages[0]]);
    setContextEstablished(false);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCodeContext(content);
    };
    reader.readAsText(file);
    
    // Limpar o input para permitir o mesmo arquivo novamente
    e.target.value = '';
  };

  // Renderização condicional para o botão de configurações
  const renderSettings = () => {
    if (!showSettings) return null;
    
    return (
      <Box sx={{ mb: 3, p: 2, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Configurações Avançadas
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
          
          <TextField
            label="Tamanho do Chunk"
            type="number"
            size="small"
            value={chunkSize}
            onChange={(e) => setChunkSize(parseInt(e.target.value))}
            InputProps={{
              inputProps: { min: 5000, max: 90000, step: 1000 }
            }}
            helperText="Caracteres por chunk"
            sx={{ width: '160px' }}
          />
        </Box>
      </Box>
    );
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
          Assistente de Código GPT-4.1
        </Typography>
        
        <Box>
          <IconButton 
            color="primary" 
            onClick={() => setShowSettings(!showSettings)}
            title="Configurações"
            sx={{ mr: 1 }}
          >
            <SettingsIcon />
          </IconButton>
          
          <IconButton 
            color="error" 
            onClick={handleClearChat} 
            disabled={isLoading || messages.length <= 1}
            title="Limpar chat"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Converse com o GPT-4.1 sobre seu código. Primeiro estabeleça o contexto enviando o código completo, depois faça perguntas específicas.
      </Typography>
      
      {renderSettings()}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Erro</AlertTitle>
          {error}
        </Alert>
      )}
      
      {!contextEstablished && (
        <Box sx={{ mb: 3, p: 2, border: '1px dashed rgba(144, 202, 249, 0.5)', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Primeiro, estabeleça o contexto do código:
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<FileUploadIcon />}
              disabled={isLoading}
            >
              Carregar Arquivo
              <input 
                type="file" 
                hidden 
                accept=".js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.html,.css" 
                onChange={handleFileUpload} 
              />
            </Button>
            
            {minifiedCode && (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => setCodeContext(minifiedCode)}
                disabled={isLoading}
                startIcon={<CodeIcon />}
              >
                Usar Código Minificado
              </Button>
            )}
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleEstablishContext}
              disabled={isLoading || !codeContext}
            >
              Estabelecer Contexto
            </Button>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder="Cole seu código aqui ou use os botões acima..."
            value={codeContext}
            onChange={(e) => setCodeContext(e.target.value)}
            disabled={isLoading}
            sx={{ 
              backgroundColor: 'rgba(30, 30, 30, 0.5)',
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
              }
            }}
          />
          
          {isLoading && chunkProgress.total > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Enviando contexto: Chunk {chunkProgress.current} de {chunkProgress.total}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(chunkProgress.current / chunkProgress.total) * 100} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: 'rgba(30, 30, 30, 0.5)',
                  '& .MuiLinearProgress-bar': { backgroundColor: 'primary.main' }
                }}
              />
            </Box>
          )}
        </Box>
      )}
      
      <Box 
        sx={{ 
          mb: 3, 
          height: '400px', 
          maxHeight: '400px', 
          overflowY: 'auto',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 1,
          backgroundColor: '#1a1a1a',
          p: 2
        }}
      >
        <List sx={{ width: '100%', padding: 0 }}>
          {messages.slice(1).map((message, index) => {
            // Verificar se é uma mensagem de chunk de código - se for, renderizar diferente
            const isCodeChunk = message.role === 'user' && message.content.includes('[CONTEXTO DE CÓDIGO');
            
            if (isCodeChunk) {
              // Extrair número do chunk do conteúdo
              const chunkMatch = message.content.match(/PARTE (\d+)\/(\d+)/);
              const chunkNumber = chunkMatch ? chunkMatch[1] : '?';
              const totalChunks = chunkMatch ? chunkMatch[2] : '?';
              
              return (
                <ListItem
                  key={index}
                  sx={{
                    p: 1,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(25, 118, 210, 0.05)',
                    borderRadius: 1
                  }}
                >
                  <Chip 
                    size="small" 
                    label={`Chunk ${chunkNumber}/${totalChunks}`} 
                    color="primary" 
                    variant="outlined"
                    icon={<CodeIcon fontSize="small" />}
                  />
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    Código adicionado ao contexto
                  </Typography>
                </ListItem>
              );
            }
            
            // Renderização padrão para mensagens normais
            return (
              <ListItem 
                key={index} 
                alignItems="flex-start"
                sx={{ 
                  flexDirection: 'column',
                  p: 1.5,
                  backgroundColor: message.role === 'user' ? 'rgba(30, 30, 30, 0.5)' : 'rgba(25, 118, 210, 0.1)',
                  borderRadius: 1,
                  mb: 1.5,
                  maxWidth: '100%'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, width: '100%' }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    mr: 1
                  }}>
                    {message.role === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                  </Box>
                  <Typography variant="subtitle2">
                    {message.role === 'user' ? 'Você' : 'Assistente'}
                  </Typography>
                </Box>
                
                <Typography 
                  variant="body2" 
                  component="pre"
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    width: '100%',
                    fontFamily: message.content.includes('```') ? '"Geist Mono", monospace' : 'inherit',
                    fontSize: '0.875rem',
                    mt: 0.5,
                    ml: 4
                  }}
                >
                  {message.content}
                </Typography>
              </ListItem>
            );
          })}
          <div ref={messagesEndRef} />
        </List>
        
        {messages.length <= 1 && !isLoading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              As mensagens aparecerão aqui. Primeiro estabeleça o contexto do código.
            </Typography>
          </Box>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          fullWidth
          placeholder="Digite sua mensagem..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading || !contextEstablished}
          multiline
          rows={2}
          sx={{ 
            backgroundColor: 'rgba(30, 30, 30, 0.5)',
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
            }
          }}
        />
        
        <Button
          variant="contained"
          color="primary"
          endIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          onClick={handleSendMessage}
          disabled={isLoading || !userInput.trim() || !contextEstablished}
          sx={{ minWidth: '100px' }}
        >
          {isLoading ? 'Enviando' : 'Enviar'}
        </Button>
      </Box>
    </Paper>
  );
};

export default CodeAssistant;