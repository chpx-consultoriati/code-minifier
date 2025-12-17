// src/components/FileTree/index.tsx
'use client';

import { useState, useEffect, Fragment } from 'react';
import { 
  Box, 
  Typography, 
  Checkbox, 
  IconButton, 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  ListItemSecondaryAction, 
  Collapse
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  ignored?: boolean;
  error?: string;
  children?: FileNode[];
}

interface FileTreeProps {
  fileStructure: FileNode;
  onSelectionChange: (selectedFiles: string[]) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  fileStructure,
  onSelectionChange
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  // Inicializa o estado de expansão quando a estrutura de arquivos muda
  useEffect(() => {
    if (fileStructure && !initialized) {
      const initialExpanded: Record<string, boolean> = {};
      
      const traverseAndCollapse = (node: FileNode) => {
        if (node.type === 'directory') {
          // Expandir automaticamente o diretório raiz para mostrar seu conteúdo
          initialExpanded[node.path] = node.path === '/' || node.path === fileStructure.path;
          node.children?.forEach(traverseAndCollapse);
        }
      };
      
      traverseAndCollapse(fileStructure);
      setExpanded(initialExpanded);
      setInitialized(true);
    }
  }, [fileStructure, initialized]);

  // Notifica o componente pai sobre arquivos selecionados apenas quando a seleção muda
  // Usando prevSelected para evitar chamadas desnecessárias
  useEffect(() => {
    // Não envie notificações durante a inicialização
    if (!initialized) return;
    
    const selectedFiles = Object.entries(selected)
      .filter(([_, isSelected]) => isSelected)
      .map(([path]) => path);
    
    onSelectionChange(selectedFiles);
  }, [selected, onSelectionChange, initialized]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleSelect = (node: FileNode) => {
    if (node.ignored) return;
    
    const newSelected = { ...selected };
    
    if (node.type === 'file') {
      newSelected[node.path] = !selected[node.path];
    } else {
      const selectRecursively = (n: FileNode, isSelected: boolean) => {
        if (n.ignored) return;
        
        if (n.type === 'file') {
          newSelected[n.path] = isSelected;
        } else {
          newSelected[n.path] = isSelected;
          n.children?.forEach(child => selectRecursively(child, isSelected));
        }
      };
      
      const newState = !isNodeSelected(node);
      selectRecursively(node, newState);
    }
    
    setSelected(newSelected);
  };

  const isNodeSelected = (node: FileNode): boolean => {
    if (node.type === 'file') {
      return !!selected[node.path];
    }
    
    if (!node.children || node.children.length === 0) {
      return !!selected[node.path];
    }
    
    const nonIgnoredChildren = node.children.filter(child => !child.ignored);
    if (nonIgnoredChildren.length === 0) return false;
    
    return nonIgnoredChildren.every(child => isNodeSelected(child));
  };

  const isNodeIndeterminate = (node: FileNode): boolean => {
    if (node.type === 'file' || !node.children || node.children.length === 0) {
      return false;
    }
    
    const nonIgnoredChildren = node.children.filter(child => !child.ignored);
    if (nonIgnoredChildren.length === 0) return false;
    
    const selectedCount = nonIgnoredChildren.filter(child => isNodeSelected(child)).length;
    return selectedCount > 0 && selectedCount < nonIgnoredChildren.length;
  };

  const renderNode = (node: FileNode, level: number = 0, isRoot: boolean = false) => {
    const isSelected = isNodeSelected(node);
    const isIndeterminate = isNodeIndeterminate(node);
    const isExpanded = expanded[node.path];
    
    // Se for o nó raiz, não renderiza o item da pasta, apenas o conteúdo
    if (isRoot && node.type === 'directory' && node.children) {
      return (
        <Fragment key={node.path}>
          {node.children.map(child => renderNode(child, level, false))}
        </Fragment>
      );
    }
    
    return (
      <Fragment key={node.path}>
        <ListItem 
          sx={{ 
            pl: level * 2, 
            opacity: node.ignored ? 0.5 : 1, 
            backgroundColor: node.ignored ? '#f5f5f5' : 'transparent' 
          }}
        >
          <ListItemIcon>
            <Checkbox 
              edge="start" 
              checked={isSelected} 
              indeterminate={isIndeterminate} 
              disabled={node.ignored} 
              onChange={() => toggleSelect(node)} 
            />
          </ListItemIcon>
          
          <ListItemIcon>
            {node.type === 'directory' ? (
              isExpanded ? <FolderOpenIcon color="primary" /> : <FolderIcon color="primary" />
            ) : (
              <InsertDriveFileIcon color="action" />
            )}
          </ListItemIcon>
          
          <ListItemText 
            primary={node.name} 
            secondary={
              node.type === 'file' 
                ? `${(node.size || 0) / 1024 < 1 
                    ? `${node.size} bytes` 
                    : `${(node.size || 0) / 1024 < 1024 
                        ? `${Math.round((node.size || 0) / 1024 * 10) / 10} KB` 
                        : `${Math.round((node.size || 0) / 1024 / 1024 * 10) / 10} MB`}`}`
                : null
            } 
          />
          
          <ListItemSecondaryAction>
            {node.type === 'directory' && node.children && node.children.length > 0 && (
              <IconButton edge="end" onClick={() => toggleExpand(node.path)}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </ListItemSecondaryAction>
        </ListItem>
        
        {node.type === 'directory' && node.children && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {node.children.map(child => renderNode(child, level + 1, false))}
            </List>
          </Collapse>
        )}
      </Fragment>
    );
  };

  if (!fileStructure) {
    return null;
  }

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Estrutura de Arquivos
        </Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Selecione os arquivos que deseja incluir na minificação. Pastas ignoradas pelo .gitignore aparecem em cinza.
      </Typography>
      
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, maxHeight: '400px', overflow: 'auto' }}>
        <List dense>
          {renderNode(fileStructure, 0, true)}
        </List>
      </Box>
    </Paper>
  );
};

export default FileTree;