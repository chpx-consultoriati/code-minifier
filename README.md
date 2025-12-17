# Documentação do MVP - Minificador de Código-fonte

## Visão Geral

Este MVP implementa uma aplicação web interativa que permite aos usuários importar arquivos compactados (ZIP) contendo códigos-fonte, realizar filtragem baseada em arquivos `.gitignore`, selecionar arquivos através de uma interface hierárquica, minificar o código selecionado e interagir com modelos de IA para análise.

## Funcionalidades Implementadas

### 1. Upload de Arquivos
- Upload de arquivos ZIP através de interface web
- Feedback visual com barra de progresso durante o upload e descompactação
- Validação de formato de arquivo

### 2. Processamento Inteligente do ZIP
- Extração segura do conteúdo do arquivo ZIP em diretório temporário
- Leitura automática e recursiva de arquivos `.gitignore`
- Exclusão automática de arquivos e diretórios mencionados nos `.gitignore`
- Exclusão automática de arquivos ocultos

### 3. Visualização Estruturada e Interativa
- Interface em formato árvore refletindo a estrutura hierárquica do ZIP
- Opção de expandir/recolher pastas
- Checkbox para seleção/deseleção individual ou em grupo
- Indicador visual para arquivos ignorados
- Exibição da quantidade total de arquivos selecionados
- Contagem de tokens por pasta e arquivo

### 4. Minificação de Arquivos
- Suporte a múltiplas linguagens (JavaScript, Python, Java, C#)
- Utilização do Tree-sitter para análise e remoção de comentários e espaços
- Unificação de todos os arquivos selecionados em um único arquivo minificado
- Visualização do resultado minificado com opção de download
- Exibição do ganho percentual obtido na minificação

### 5. Seleção Inteligente Assistida por IA
- Análise do conteúdo dos arquivos (simulada no MVP)
- Interface para informar o objetivo do processamento
- Sugestão automática de arquivos relevantes
- Destaque visual das sugestões na interface
- Revisão e ajuste das sugestões pelo usuário

### 6. Integração com IA
- Interface para envio do arquivo minificado para análise por modelos de LLM
- Interface de chat para interação baseada no contexto do arquivo
- Escolha entre múltiplos modelos de IA (GPT-4, Claude-3, Llama-3)
- Exibição do consumo estimado de tokens

## Tecnologias Utilizadas

- **Frontend e Backend**: Next.js
- **Interface de Usuário**: Material UI
- **Análise Sintática**: Tree-sitter
- **Processamento de Arquivos**: AdmZip, Formidable
- **Simulação de IA**: APIs simuladas (no MVP)

## Como Usar

1. **Upload de Arquivo**:
   - Clique em "Selecionar Arquivo ZIP" e escolha um arquivo ZIP contendo código-fonte
   - Clique em "Processar Arquivo ZIP" para iniciar o upload e extração

2. **Seleção de Arquivos**:
   - Use a seção "Seleção Inteligente Assistida por IA" para obter sugestões
   - Informe o objetivo da análise e clique em "Analisar com IA"
   - Selecione/deselecione arquivos manualmente na visualização em árvore
   - Expanda/recolha pastas conforme necessário

3. **Minificação**:
   - Clique em "Minificar Código" para processar os arquivos selecionados
   - Visualize o resultado da minificação e estatísticas de redução
   - Faça download do código minificado se desejado

4. **Interação com IA**:
   - Selecione um modelo de IA (GPT-4, Claude-3, Llama-3)
   - Digite uma pergunta ou instrução no campo de texto
   - Clique em "Enviar" para obter a análise da IA
   - Continue a conversa com perguntas adicionais

## Limitações do MVP

- A integração com IA usa respostas simuladas (não há conexão real com APIs de LLM)
- O processamento de regras .gitignore é básico e pode ser aprimorado
- A contagem de tokens é uma estimativa simplificada
- Não há persistência de dados entre sessões

## Próximos Passos

- Integração real com APIs de LLM (OpenAI, Anthropic, etc.)
- Melhorias no processamento de regras .gitignore
- Algoritmo mais preciso para contagem de tokens
- Otimizações de desempenho para arquivos grandes
- Persistência de sessões e histórico de conversas
- Suporte a mais linguagens de programação
