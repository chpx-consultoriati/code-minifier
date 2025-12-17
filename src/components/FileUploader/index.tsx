// src/components/FileUploader/index.tsx
'use client';

import { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  LinearProgress, 
  Paper, 
  Alert, 
  AlertTitle 
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploaderProps {
  onFileProcessed: (fileStructure: any) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileProcessed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.zip')) {
        setError('Por favor, selecione um arquivo ZIP válido.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    const formData = new FormData();
    formData.append('zipFile', file);
    
    try {
      const progressInterval = setInterval(() => {
        setProgress((prevProgress) => {
          const newProgress = prevProgress + 10;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return newProgress;
        });
      }, 300);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao processar o arquivo ZIP');
      }
      
      setProgress(100);
      const data = await response.json();
      console.log('Resposta da API de upload:', data);
      onFileProcessed(data);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro durante o upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        borderRadius: 2, 
        mb: 4,
        bgcolor: 'background.paper', // Usa a cor de fundo do tema
        border: '1px solid rgba(255, 255, 255, 0.1)' // Adiciona uma borda sutil
      }}
    >
      <Typography variant="h5" component="h2" gutterBottom>
        Upload de Código-Fonte
      </Typography>
      
      <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Faça upload de um arquivo ZIP contendo seu código-fonte para análise e minificação.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
          <AlertTitle>Erro</AlertTitle>
          {error}
        </Alert>
      )}
      
      <Box 
        sx={{ 
          border: '2px dashed rgba(144, 202, 249, 0.5)', // Cor da borda combinando com o tema
          borderRadius: 2, 
          p: 3, 
          width: '100%', 
          textAlign: 'center', 
          mb: 3, 
          backgroundColor: 'rgba(30, 30, 30, 0.5)' // Escurece o fundo da área de drop
        }}
      >
        <input 
          accept=".zip" 
          style={{ display: 'none' }} 
          id="file-upload" 
          type="file" 
          onChange={handleFileChange} 
          disabled={uploading} 
        />
        
        <label htmlFor="file-upload">
          <Button 
            component="span" 
            variant="contained" 
            startIcon={<CloudUploadIcon />} 
            disabled={uploading} 
            sx={{ mb: 2 }}
          >
            Selecionar Arquivo ZIP
          </Button>
        </label>
        
        {file && (
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </Typography>
        )}
      </Box>
      
      {file && (
        <>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUpload} 
            disabled={uploading} 
            fullWidth 
            sx={{ mb: 2 }}
          >
            {uploading ? 'Processando...' : 'Processar Arquivo ZIP'}
          </Button>
          
          {uploading && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: 'rgba(30, 30, 30, 0.5)', // Fundo escuro para o progresso
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'primary.main' // Cor da barra de progresso
                  }
                }} 
              />
              
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                {progress < 100 ? 'Processando arquivo...' : 'Concluído!'}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};

export default FileUploader;