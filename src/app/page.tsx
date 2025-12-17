'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { 
  Container, Box, Typography, CssBaseline, ThemeProvider, 
  createTheme, Stepper, Step, StepLabel, Paper
} from '@mui/material';
import FileUploader from '@/components/FileUploader';
import FileTree from '@/components/FileTree';
import MinifiedOutput from '@/components/MinifiedOutput';

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
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: '#90caf9',
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#909090',
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          '&.Mui-completed': {
            color: '#4caf50',
          },
          '&.Mui-active': {
            color: '#90caf9',
          },
        },
      },
    },
  },
});

const steps = [
  'Upload de Código',
  'Seleção de Arquivos',
  'Minificação e Análise'
];

export default function Home() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [fileStructure, setFileStructure] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [extractDir, setExtractDir] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [minifiedCode, setMinifiedCode] = useState('');
  
  const handleFileProcessed = (data) => {
    console.log('Dados recebidos em handleFileProcessed:', data);
    if (!data || !data.fileStructure) {
      console.error('Erro: dados inválidos recebidos do upload', data);
      return;
    }
    setFileStructure(data.fileStructure);
    setSessionId(data.sessionId);
    setExtractDir(data.extractDir);
    console.log('Estado atualizado:', {
      fileStructure: data.fileStructure,
      sessionId: data.sessionId,
      extractDir: data.extractDir
    });
    setActiveStep(1);
  };

  // Usando useCallback para memoizar a função e evitar renderizações infinitas
  const handleSelectionChange = useCallback((files) => {
    setSelectedFiles(files);
    if (files.length > 0 && activeStep === 1) {
      setActiveStep(2);
    }
  }, [activeStep]);

  const handleMinificationComplete = (result) => {
    if (result && result.content) {
      setMinifiedCode(result.content);
    }
  };

  const handleAnalyzeWithAI = () => {
    if (sessionId) {
      router.push(`/chat/${sessionId}`);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          backgroundColor: darkTheme.palette.background.default,
          minHeight: '100vh',
          width: '100%',
          pt: 2,
          pb: 4
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ my: 4 }}>
            <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
              Minificador de Código-fonte
            </Typography>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              align="center"
              color="text.secondary"
              sx={{ mb: 4 }}
            >
              Importe, selecione e minifique seu código para análise
            </Typography>
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {activeStep === 0 && <FileUploader onFileProcessed={handleFileProcessed} />}
            
            {activeStep >= 1 && fileStructure && (
              <FileTree
                fileStructure={fileStructure}
                onSelectionChange={handleSelectionChange}
              />
            )}
            
            {activeStep >= 2 && sessionId && selectedFiles.length > 0 && (
              <MinifiedOutput
                sessionId={sessionId}
                selectedFiles={selectedFiles}
                onMinificationComplete={handleMinificationComplete}
                onAnalyzeWithAI={handleAnalyzeWithAI}
              />
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}