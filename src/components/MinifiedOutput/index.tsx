'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Alert, AlertTitle, Paper, List,
  ListItem, ListItemText, Divider, Chip, LinearProgress
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Info as InfoIcon, 
  Code as CodeIcon,
  Chat as ChatIcon
} from '@mui/icons-material';

interface MinifiedOutputProps {
  sessionId: string;
  selectedFiles: string[];
  onMinificationComplete?: (result: any) => void;
  onAnalyzeWithAI?: () => void;
}

const MinifiedOutput: React.FC<MinifiedOutputProps> = ({
  sessionId,
  selectedFiles,
  onMinificationComplete,
  onAnalyzeWithAI
}) => {
  const [minifying, setMinifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkippedFiles, setShowSkippedFiles] = useState(false);
  const [result, setResult] = useState<{
    content: string;
    originalSize: number;
    minifiedSize: number;
    reductionPercentage: string;
    files: { path: string; originalSize: number; minifiedSize: number }[];
    skippedFiles?: number;
    unsupportedFiles?: string[];
  } | null>(null);

  useEffect(() => {
    if (result && onMinificationComplete) {
      onMinificationComplete(result);
    }
  }, [result, onMinificationComplete]);

  // Função isFile que não usa módulos de servidor
  const isFile = (filePath: string): boolean => {
    // Verificar se a string tem uma extensão de arquivo
    const lastDotIndex = filePath.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filePath.length - 1;
    const doesNotEndWithSeparator = !filePath.endsWith('/') && !filePath.endsWith('\\');
    return hasExtension && doesNotEndWithSeparator;
  };

  const handleMinify = async () => {
    const filesToProcess = selectedFiles.filter(isFile);
    if (filesToProcess.length === 0) {
      setError('Nenhum arquivo selecionado para minificação.');
      return;
    }

    setMinifying(true);
    setError(null);

    try {
      const response = await fetch('/api/minify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          filePaths: filesToProcess,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao minificar os arquivos');
      }

      const data = await response.json();
      const processedFilePaths = data.files.map((file: any) => file.path);
      const unsupportedFiles = filesToProcess
        .filter(file => !processedFilePaths.includes(file))
        .filter(isFile);

      const resultData = {
        content: data.content,
        originalSize: data.originalSize,
        minifiedSize: data.minifiedSize,
        reductionPercentage: data.reductionPercentage,
        files: data.files,
        skippedFiles: unsupportedFiles.length,
        unsupportedFiles
      };

      setResult(resultData);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro durante a minificação');
    } finally {
      setMinifying(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const blob = new Blob([result.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minified-code.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeClick = () => {
    if (onAnalyzeWithAI) {
      onAnalyzeWithAI();
    }
  };

  const fileCount = selectedFiles.filter(isFile).length;

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
          Minificação de Código
        </Typography>
        <Chip label={`${fileCount} arquivos selecionados`} color="primary" variant="outlined" />
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        Minifique os arquivos selecionados para remover comentários, docstrings e espaços em branco excessivos.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Erro</AlertTitle>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CodeIcon />}
          onClick={handleMinify}
          disabled={minifying || fileCount === 0}
          sx={{ flexGrow: 1 }}
        >
          {minifying ? 'Minificando...' : 'Minificar Código'}
        </Button>

        {result && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ChatIcon />}
            onClick={handleAnalyzeClick}
            sx={{ flexGrow: 1 }}
          >
            Analisar com IA
          </Button>
        )}
      </Box>

      {minifying && (
        <Box sx={{ width: '100%', mb: 3 }}>
          <LinearProgress sx={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(30, 30, 30, 0.5)', '& .MuiLinearProgress-bar': { backgroundColor: 'primary.main' } }} />
        </Box>
      )}

      {result && (
        <>
          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Resultado da Minificação
            </Typography>

            {result.skippedFiles > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Arquivos ignorados</AlertTitle>
                <Typography variant="body2">
                  {result.skippedFiles} arquivo(s) não suportado(s) foram ignorados durante a minificação.
                </Typography>
                <Button
                  size="small"
                  startIcon={<InfoIcon />}
                  onClick={() => setShowSkippedFiles(!showSkippedFiles)}
                  sx={{ mt: 1 }}
                >
                  {showSkippedFiles ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                </Button>

                {showSkippedFiles && result.unsupportedFiles && result.unsupportedFiles.length > 0 && (
                  <List dense sx={{ mt: 1, maxHeight: '150px', overflow: 'auto', bgcolor: 'rgba(30, 30, 30, 0.5)' }}>
                    {result.unsupportedFiles.map((file, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={file} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2">
                Tamanho original: {(result.originalSize / 1024).toFixed(2)} KB
              </Typography>
              <Typography variant="body2">
                Tamanho minificado: {(result.minifiedSize / 1024).toFixed(2)} KB
              </Typography>
              <Typography variant="body2" color="success.main" fontWeight="bold">
                Redução: {result.reductionPercentage}%
              </Typography>
            </Box>

            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />} 
              onClick={handleDownload} 
              sx={{ mb: 2 }}
            >
              Download do Código Minificado
            </Button>

            <Box sx={{ 
              p: 2, 
              backgroundColor: '#1a1a1a', 
              color: '#e0e0e0', 
              borderRadius: 1, 
              maxHeight: '300px', 
              overflow: 'auto', 
              fontFamily: 'monospace', 
              fontSize: '0.875rem',
              border: '1px solid rgba(255, 255, 255, 0.1)' 
            }}>
              <pre style={{ 
                margin: 0, 
                whiteSpace: 'pre-wrap', 
                backgroundColor: '#1a1a1a', 
                color: '#e0e0e0' 
              }}>
                {result.content.length > 1000 ? result.content.substring(0, 1000) + '...' : result.content}
              </pre>
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default MinifiedOutput;