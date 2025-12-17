// ----- src/components/RagCodeAssistant/index.tsx -----
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
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
import SearchIcon from '@mui/icons-material/Search';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RelevantSnippet {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  text: string;
  score?: number;
}

interface RagCodeAssistantProps {
  minifiedCode?: string; // Opcional, para iniciar o contexto com código minificado
}

const RagCodeAssistant: React.FC<RagCodeAssistantProps> = ({ minifiedCode }) => {
  // Estados principais
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexStatus, setIndexStatus] = useState<'idle' | 'indexing' | 'indexed' | 'error'>('idle');
  const [indexProgress, setIndexProgress] = useState(0);
  const [relevantSnippets, setRelevantSnippets] = useState<RelevantSnippet[]>([]);
  const [showSnippets, setShowSnippets] = useState(true);
  
  // Estado para arquivos a serem indexados
  const [filesToIndex, setFilesToIndex] = useState<Array<{path: string, content: string}>>([]);
  
  // Referências para UI
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Effect para rolar para a última mensagem quando há mensagens novas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Effect para definir o código minificado para indexação, se fornecido
  useEffect(() => {
    if (minifiedCode && filesToIndex.length === 0) {
      // Adicionar o código minificado como um arquivo a ser indexado
      setFilesToIndex([
        { path: 'minified-code.txt', content: minifiedCode }
      ]);
    }
  }, [minifiedCode, filesToIndex]);

  /**
   * Indexa os arquivos de código no banco vetorial
   */
  const handleIndexCode = async () => {
    if (filesToIndex.length === 0) {
      setError('Não há código para indexar.');
      return;
    }
    
    setIsLoading(true);
    setIndexStatus('indexing');
    setError(null);
    
    try {
      // Verifica se todos os arquivos têm conteúdo
      const validFiles = filesToIndex.filter(file => file.content && file.content.trim().length > 0);
      
      if (validFiles.length === 0) {
        throw new Error('Os arquivos selecionados não contêm conteúdo válido para indexação.');
      }
      
      console.log('Enviando arquivos para indexação:', validFiles.map(f => f.path));
      
      const response = await fetch('/api/indexCode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: validFiles }),
      });
      
      // Verificar resposta
      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        const responseText = await response.text();
        
        try {
          // Tentar extrair a mensagem de erro como JSON
          const errorData = JSON.parse(responseText);
          errorMessage = `${errorMessage}: ${errorData.message || 'Falha ao indexar código'}`;
          
          // Logar detalhes adicionais para diagnóstico
          if (errorData.details) {
            console.error('Detalhes do erro:', errorData.details);
          }
        } catch (e) {
          // A resposta não é um JSON válido
          console.error('Resposta não é um JSON válido:', responseText);
          
          // Extrair mensagens de erro específicas do Pinecone
          if (responseText.includes('PineconeClient is not a constructor')) {
            errorMessage = `${errorMessage}: Erro com a biblioteca Pinecone. Verifique se você está usando a versão correta da biblioteca.`;
          } else if (responseText.includes('indexesList.some is not a function')) {
            errorMessage = `${errorMessage}: Erro no formato de resposta do Pinecone. Verifique a compatibilidade da API.`;
          } else if (responseText.includes('Invalid api key provided')) {
            errorMessage = `${errorMessage}: Chave API do Pinecone inválida. Verifique suas variáveis de ambiente.`;
          } else {
            errorMessage = `${errorMessage}: Resposta inválida do servidor`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Falha ao indexar código');
      }
      
      setIndexStatus('indexed');
      setMessages([
        { role: 'system', content: 'Código indexado com sucesso! Agora você pode fazer perguntas sobre ele.' }
      ]);
      
    } catch (err: any) {
      setIndexStatus('error');
      setError(err.message || 'Ocorreu um erro ao indexar o código');
      console.error('Erro detalhado ao indexar código:', err);
      
      // Adiciona informações adicionais para diagnóstico
      setMessages([
        { role: 'system', content: `Erro ao indexar código: ${err.message}. Certifique-se de que todas as dependências estão configuradas corretamente.` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Envia uma pergunta para o assistente
   */
  const handleSendMessage = async () => {
    if (!userInput.trim() || indexStatus !== 'indexed') return;
    
    const userMessage = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Adicionar mensagem do usuário
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage }
      ]);
      
      // Enviar pergunta para a API
      const response = await fetch('/api/codeQuestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Falha ao obter resposta`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Falha ao obter resposta');
      }
      
      // Adicionar resposta do assistente
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer }
      ]);
      
      // Atualizar snippets relevantes (na aplicação real, a API retornaria isso)
      if (data.relevantSnippets) {
        setRelevantSnippets(data.relevantSnippets);
      }
      
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar a mensagem');
      console.error('Erro ao processar mensagem:', err);
      
      // Adicionar mensagem de erro
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Erro: ${err.message}` }
      ]);
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
    setMessages([]);
    setRelevantSnippets([]);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Processar múltiplos arquivos
    const newFiles: Array<{path: string, content: string}> = [];
    let filesProcessed = 0;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        newFiles.push({
          path: file.name,
          content
        });
        
        filesProcessed++;
        
        // Quando todos os arquivos forem processados, atualizar o estado
        if (filesProcessed === files.length) {
          setFilesToIndex(prev => [...prev, ...newFiles]);
        }
      };
      
      reader.readAsText(file);
    });
    
    // Limpar o input para permitir a mesma seleção novamente
    e.target.value = '';
  };

  // Mock para snippets relevantes (em uma implementação real, isso viria da API de questionamento)
  const mockRelevantSnippets: RelevantSnippet[] = [
    {
      id: 'file1.ts::1',
      filePath: 'src/components/MinifiedOutput/index.tsx',
      startLine: 10,
      endLine: 30,
      text: 'function handleMinify() {\n  // Código para minificação\n  console.log("Minificando código");\n  return "Código minificado";\n}',
      score: 0.92
    },
    {
      id: 'file2.ts::2',
      filePath: 'src/utils/minifier.ts',
      startLine: 15,
      endLine: 45,
      text: 'export function minifyCode(code: string): string {\n  // Remove comentários\n  let result = code.replace(/\\/\\/.*$/gm, "");\n  // Remove espaços em excesso\n  result = result.replace(/\\s+/g, " ");\n  return result;\n}',
      score: 0.85
    }
  ];

  // Renderização do painel de snippets relevantes
  const renderSnippets = () => {
    // Use relevantSnippets em produção, ou mockRelevantSnippets para demonstração
    const snippets = relevantSnippets.length > 0 ? relevantSnippets : (indexStatus === 'indexed' ? mockRelevantSnippets : []);
    
    if (snippets.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 2, color: 'text.secondary' }}>
          <Typography variant="body2">
            Snippets de código relevantes aparecerão aqui após fazer uma pergunta.
          </Typography>
        </Box>
      );
    }
    
    return (
      <List sx={{ width: '100%', p: 0 }}>
        {snippets.map((snippet, index) => (
          <Accordion 
            key={snippet.id} 
            sx={{ 
              mb: 1, 
              backgroundColor: 'rgba(30, 30, 30, 0.5)', 
              '&:before': { display: 'none' } 
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                flexDirection: 'row-reverse', 
                '& .MuiAccordionSummary-expandIconWrapper': { mr: 1 } 
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {snippet.filePath}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Linhas {snippet.startLine}-{snippet.endLine} 
                    {snippet.score && ` • Relevância: ${(snippet.score * 100).toFixed(0)}%`}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Box 
                component="pre" 
                sx={{ 
                  p: 2,
                  m: 0,
                  overflow: 'auto',
                  backgroundColor: '#1a1a1a',
                  color: '#e0e0e0',
                  borderRadius: '0 0 4px 4px',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {snippet.text}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </List>
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
          Assistente de Código RAG
        </Typography>
        
        <Box>
          <IconButton 
            color="primary" 
            onClick={() => setShowSnippets(!showSnippets)}
            title={showSnippets ? "Ocultar snippets" : "Mostrar snippets"}
            sx={{ mr: 1 }}
          >
            <SearchIcon />
          </IconButton>
          
          <IconButton 
            color="error" 
            onClick={handleClearChat} 
            disabled={isLoading || messages.length === 0}
            title="Limpar chat"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Este assistente usa Retrieval-Augmented Generation (RAG) para responder a perguntas sobre seu código, 
        buscando apenas os trechos relevantes em vez de carregar todo o contexto.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Erro</AlertTitle>
          {error}
        </Alert>
      )}
      
      {/* Status de indexação */}
      {indexStatus !== 'indexed' && (
        <Box sx={{ mb: 3, p: 2, border: '1px dashed rgba(144, 202, 249, 0.5)', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Primeiro, vamos indexar seu código:
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<FileUploadIcon />}
              disabled={isLoading}
            >
              Carregar Arquivos
              <input 
                type="file" 
                hidden 
                accept=".js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.html,.css" 
                onChange={handleFileUpload}
                multiple
              />
            </Button>
            
            {minifiedCode && filesToIndex.length === 0 && (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => setFilesToIndex([{ path: 'minified-code.txt', content: minifiedCode }])}
                disabled={isLoading}
                startIcon={<CodeIcon />}
              >
                Usar Código Minificado
              </Button>
            )}
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleIndexCode}
              disabled={isLoading || filesToIndex.length === 0}
              startIcon={<StorageIcon />}
            >
              {isLoading ? 'Indexando...' : 'Indexar Código'}
            </Button>
          </Box>
          
          {/* Lista de arquivos selecionados */}
          {filesToIndex.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                {filesToIndex.length} arquivo(s) selecionado(s) para indexação:
              </Typography>
              
              <List dense sx={{ 
                bgcolor: 'rgba(30, 30, 30, 0.5)', 
                borderRadius: 1, 
                maxHeight: '150px', 
                overflow: 'auto' 
              }}>
                {filesToIndex.map((file, index) => (
                  <ListItem key={index}>
                    <Typography variant="body2" noWrap>
                      {file.path}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {isLoading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Indexando código...
              </Typography>
              <LinearProgress 
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
      
      {/* Interface de chat com layout flexível */}
      <Box sx={{ display: 'flex', gap: 2, height: '400px' }}>
        {/* Área de chat */}
        <Box 
          sx={{ 
            flexGrow: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Mensagens */}
          <Box 
            sx={{ 
              flexGrow: 1,
              mb: 2, 
              overflowY: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 1,
              backgroundColor: '#1a1a1a',
              p: 2
            }}
          >
            <List sx={{ width: '100%', padding: 0 }}>
              {messages.map((message, index) => (
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
              ))}
              <div ref={messagesEndRef} />
            </List>
            
            {messages.length === 0 && !isLoading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {indexStatus === 'indexed' 
                    ? 'Faça uma pergunta sobre seu código.' 
                    : 'Primeiro, indexe seu código para começar a conversa.'}
                </Typography>
              </Box>
            )}
          </Box>
          
          {/* Input de chat */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              placeholder={indexStatus === 'indexed' 
                ? "Digite sua pergunta sobre o código..." 
                : "Primeiro, indexe seu código para fazer perguntas..."}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading || indexStatus !== 'indexed'}
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
              disabled={isLoading || !userInput.trim() || indexStatus !== 'indexed'}
              sx={{ minWidth: '100px' }}
            >
              {isLoading ? 'Enviando' : 'Enviar'}
            </Button>
          </Box>
        </Box>
        
        {/* Painel de snippets relevantes (condicional) */}
        {showSnippets && (
          <Box 
            sx={{ 
              width: '350px',
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 1,
              backgroundColor: '#1a1a1a',
            }}
          >
            <Box sx={{ 
              p: 1, 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(25, 118, 210, 0.1)'
            }}>
              <Typography variant="subtitle2">
                Snippets Relevantes
              </Typography>
            </Box>
            
            <Box sx={{ 
              flexGrow: 1, 
              overflow: 'auto',
              p: 1
            }}>
              {renderSnippets()}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default RagCodeAssistant;