'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Box, Typography, TextField, Button, Paper, CssBaseline, ThemeProvider, 
  createTheme, Avatar, Divider, CircularProgress, IconButton, Alert, AlertTitle,
  List, ListItem
} from '@mui/material';
import { 
  Send as SendIcon, 
  ArrowBack as ArrowBackIcon,
  Code as CodeIcon,
  Person as PersonIcon,
  SmartToy as SmartToyIcon,
  DeleteOutline as DeleteIcon
} from '@mui/icons-material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#1e1e1e',
      paper: '#2d2d2d',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { sessionId } = useParams() as { sessionId: string };
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Conectando ao assistente de código...' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeChat = async () => {
      setIsIndexing(true);
      try {
        // First, check if this session has been indexed
        const checkResponse = await fetch(`/api/checkSessionIndex?sessionId=${sessionId}`);
        
        if (!checkResponse.ok) {
          throw new Error(`Erro ao verificar status da indexação: ${checkResponse.status}`);
        }
        
        const checkData = await checkResponse.json();

        if (!checkData.indexed) {
          // If not indexed, index the code
          setMessages([
            { role: 'system', content: 'Indexando o código para o assistente. Isso pode levar alguns segundos...' }
          ]);

          // Primeiro, vamos obter o código minificado para indexação
          const minifiedResponse = await fetch(`/api/getMinifiedCode?sessionId=${sessionId}`);
          
          if (!minifiedResponse.ok) {
            throw new Error(`Não foi possível obter o código minificado: ${minifiedResponse.status}`);
          }
          
          const minifiedData = await minifiedResponse.json();
          
          if (!minifiedData.success) {
            throw new Error(minifiedData.message || 'Falha ao obter código minificado');
          }
          
          // Agora vamos indexar o código com o código minificado obtido
          const indexResponse = await fetch('/api/indexCode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              sessionId,
              files: [
                {
                  path: 'minified-code.txt',
                  content: minifiedData.content
                }
              ]
            }),
          });

          if (!indexResponse.ok) {
            throw new Error(`Erro ao indexar código: ${indexResponse.status}`);
          }

          const indexData = await indexResponse.json();
          if (!indexData.success) {
            throw new Error(indexData.message || 'Falha ao indexar código');
          }
        }

        // Set initial welcome message
        setMessages([
          { 
            role: 'assistant', 
            content: 'Olá! Estou pronto para responder perguntas sobre seu código. Como posso ajudar?' 
          }
        ]);
      } catch (err: any) {
        console.error('Erro ao inicializar chat:', err);
        setError(err.message || 'Ocorreu um erro ao preparar o assistente');
        setMessages([
          { 
            role: 'system', 
            content: `Erro ao inicializar o assistente: ${err.message}. Verifique se o código foi processado corretamente.` 
          }
        ]);
      } finally {
        setIsIndexing(false);
      }
    };

    if (sessionId) {
      initializeChat();
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage }
      ]);

      const response = await fetch('/api/codeQuestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Falha ao obter resposta`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Falha ao obter resposta');
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer }
      ]);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar a mensagem');
      console.error('Erro ao processar mensagem:', err);
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
    setMessages([
      { role: 'assistant', content: 'Olá! Estou pronto para responder perguntas sobre seu código. Como posso ajudar?' }
    ]);
    setError(null);
  };

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        backgroundColor: darkTheme.palette.background.default 
      }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(35, 35, 35, 0.8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              color="primary" 
              onClick={handleGoBack}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6">
              Assistente de Código IA
            </Typography>
          </Box>
          <Box>
            <IconButton 
              color="error" 
              onClick={handleClearChat}
              disabled={isLoading || messages.length <= 1}
              title="Limpar conversa"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Chat content */}
        <Box sx={{ 
          flexGrow: 1, 
          p: 2, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {isIndexing ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '100%'
            }}>
              <CircularProgress size={60} />
              <Typography sx={{ mt: 2 }}>
                Indexando seu código para análise...
              </Typography>
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <AlertTitle>Erro</AlertTitle>
                  {error}
                </Alert>
              )}
              
              <List sx={{ width: '100%', padding: 0 }}>
                {messages.map((message, index) => (
                  <ListItem 
                    key={index} 
                    alignItems="flex-start" 
                    sx={{ 
                      flexDirection: 'column', 
                      p: 1.5, 
                      backgroundColor: message.role === 'user' 
                        ? 'rgba(30, 30, 30, 0.5)' 
                        : message.role === 'system'
                          ? 'rgba(30, 30, 30, 0.8)'
                          : 'rgba(25, 118, 210, 0.1)', 
                      borderRadius: 1, 
                      mb: 1.5, 
                      maxWidth: '100%' 
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, width: '100%' }}>
                      <Avatar
                        sx={{ 
                          bgcolor: message.role === 'user' 
                            ? 'primary.main' 
                            : message.role === 'system'
                              ? 'grey.700'
                              : 'secondary.main',
                          width: 28,
                          height: 28,
                          mr: 1
                        }}
                      >
                        {message.role === 'user' 
                          ? <PersonIcon fontSize="small" /> 
                          : message.role === 'system'
                            ? <CodeIcon fontSize="small" />
                            : <SmartToyIcon fontSize="small" />
                        }
                      </Avatar>
                      <Typography variant="subtitle2">
                        {message.role === 'user' 
                          ? 'Você' 
                          : message.role === 'system'
                            ? 'Sistema'
                            : 'Assistente'
                        }
                      </Typography>
                    </Box>
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-word', 
                        width: '100%', 
                        fontFamily: message.content.includes('```') 
                          ? '"Geist Mono", monospace' 
                          : 'inherit', 
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
                    Inicie uma conversa com o assistente sobre seu código.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Input area */}
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(35, 35, 35, 0.8)'
        }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              placeholder="Digite sua mensagem..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading || isIndexing}
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
              disabled={isLoading || !userInput.trim() || isIndexing}
              sx={{ minWidth: '100px' }}
            >
              {isLoading ? 'Enviando' : 'Enviar'}
            </Button>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}