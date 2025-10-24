import { h } from 'preact';

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface FileReviewTabProps {
  vscode: any;
}

interface WorkspaceItem {
  name: string;
  path: string;
  relativePath: string;
}

interface DirectoryContents {
  directories: WorkspaceItem[];
  files: WorkspaceItem[];
}

type FolderState = Record<string, boolean>;
type FolderLoadingState = Record<string, boolean>;
type FolderContentsState = Record<string, DirectoryContents>;
type FileLookupState = Record<string, WorkspaceItem>;

export default function FileReviewTab({ vscode }: FileReviewTabProps) {
  const [folders, setFolders] = useState<WorkspaceItem[]>([]);
  const [rootFiles, setRootFiles] = useState<WorkspaceItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<FolderState>({});
  const [contentsByFolder, setContentsByFolder] = useState<FolderContentsState>({});
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<FolderLoadingState>({});
  const [selectedFilePaths, setSelectedFilePaths] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileLookupRef = useRef<FileLookupState>({});

  const requestWorkspaceData = useCallback(() => {
    if (!vscode) {
      return;
    }
    setLoadingFolders(true);
    vscode.postMessage({ type: 'requestWorkspaceFolders' });
  }, [vscode]);

  useEffect(() => {
    requestWorkspaceData();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'workspaceFolders') {
        const data = message.data ?? {};
        const directories: WorkspaceItem[] = Array.isArray(data.directories) ? data.directories : [];
        const files: WorkspaceItem[] = Array.isArray(data.files) ? data.files : [];
        setFolders(directories);
        setRootFiles(files);
        setLoadingFolders(false);
        setErrorMessage(null);

        const next = { ...fileLookupRef.current };
        files.forEach(file => {
          next[file.path] = file;
        });
        fileLookupRef.current = next;
      }

      if (message.type === 'workspaceFoldersError') {
        setLoadingFolders(false);
        setErrorMessage(message.error || 'Unable to load workspace folders.');
      }

      if (message.type === 'filesInFolder') {
        const folderPath = message.folderPath as string;
        const data = message.data ?? {};
        const directories: WorkspaceItem[] = Array.isArray(data.directories) ? data.directories : [];
        const files: WorkspaceItem[] = Array.isArray(data.files) ? data.files : [];

        if (message.error) {
          setErrorMessage(message.error);
        } else {
          setErrorMessage(null);
        }

        setContentsByFolder(prev => ({
          ...prev,
          [folderPath]: {
            directories,
            files
          }
        }));

        const next = { ...fileLookupRef.current };
        files.forEach(file => {
          next[file.path] = file;
        });
        fileLookupRef.current = next;

        setLoadingFiles(prev => ({
          ...prev,
          [folderPath]: false
        }));
      }

      if (message.type === 'fileReviewSubmitted') {
        const filePath = message.filePath as string;
        const lookup = fileLookupRef.current;
        if (filePath && lookup[filePath]) {
          setStatusMessage(`Opened file for review: ${lookup[filePath].relativePath}`);
        } else if (filePath) {
          setStatusMessage(`Opened file for review: ${filePath}`);
        } else {
          setStatusMessage('Opened file for review.');
        }
      }

      if (message.type === 'fileReviewError') {
        setStatusMessage(null);
        setErrorMessage(message.error || 'Unable to open the selected file.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [requestWorkspaceData]);

  const toggleFolder = useCallback((folder: WorkspaceItem) => {
    const isExpanded = !!expandedFolders[folder.path];

    setExpandedFolders(prev => ({
      ...prev,
      [folder.path] : !isExpanded
    }));

    if (!isExpanded && !contentsByFolder[folder.path]) {
      setLoadingFiles(prev => ({
        ...prev,
        [folder.path]: true
      }));

      if (vscode) {
        vscode.postMessage({ type: 'requestFilesInFolder', folderPath: folder.path });
      }
    }
  }, [expandedFolders, contentsByFolder, vscode]);

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFilePaths(prev => ({ ...prev, [filePath]: !prev[filePath] }));
    setStatusMessage(null);
  }, []);

  const handleSubmit = useCallback(() => {
    const selected = Object.keys(selectedFilePaths).filter(k => selectedFilePaths[k]);
    if (selected.length === 0) {
      setStatusMessage('Please choose one or more files before submitting.');
      return;
    }

    setStatusMessage('Submitting selected files for review...');
    setErrorMessage(null);

    if (vscode) {
      vscode.postMessage({ type: 'submitFilesReview', filePaths: selected });
    }
  }, [selectedFilePaths, vscode]);

  const WHITELIST = ['cs', 'ts', 'tsx', 'js', 'php', 'java'];

  const isWhitelisted = (file: WorkspaceItem) => {
    const parts = file.name.split('.');
    if (parts.length === 1) return false;
    const ext = parts[parts.length - 1].toLowerCase();
    return WHITELIST.includes(ext);
  };

  const renderFileOption = (file: WorkspaceItem): ReactNode => {
    if (!isWhitelisted(file)) return null;

    const checked = !!selectedFilePaths[file.path];

    return (
      <li key={file.path} style={{ marginBottom: '0.4rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="file-review-selection"
            value={file.path}
            checked={checked}
            onChange={() => handleFileSelect(file.path)}
          />
          <span>{file.relativePath}</span>
        </label>
      </li>
    ) as unknown as ReactNode;
  };

  const renderFolderRow = (folder: WorkspaceItem, depth: number = 0): ReactNode => {
    const isExpanded = !!expandedFolders[folder.path];
    const contents = contentsByFolder[folder.path];
    const paddingLeft = depth * 16;

    return (
      <li key={folder.path} style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft }}>
          <button
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--vscode-foreground)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: 0,
              width: '2rem',
              textAlign: 'left'
            }}
            onClick={() => toggleFolder(folder)}
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
          <span style={{ fontWeight: 600 }}>{folder.relativePath || folder.name}</span>
        </div>

        {isExpanded && (
          <div style={{ marginLeft: paddingLeft + 16, marginTop: '0.5rem' }}>
            {loadingFiles[folder.path] && <div>Loading files...</div>}

            {!loadingFiles[folder.path] && contents && contents.directories.length === 0 && contents.files.length === 0 && (
              <div>No entries found in this folder.</div>
            )}

            {!loadingFiles[folder.path] && contents && contents.directories.length > 0 && (
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {contents.directories.map(childFolder => renderFolderRow(childFolder, depth + 1))}
              </ul>
            )}

            {!loadingFiles[folder.path] && contents && contents.files.length > 0 && (
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {contents.files.map(file => renderFileOption(file))}
              </ul>
            )}
          </div>
        )}
      </li>
    ) as unknown as ReactNode;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>File Review</h3>
        <p style={{ margin: 0, color: 'var(--vscode-descriptionForeground)' }}>
          Browse folders, choose the file you want to review, then submit to open it.
        </p>
      </div>

      {errorMessage && (
        <div style={{ background: '#ff000022', color: '#ff6666', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ff6666' }}>
          {errorMessage}
        </div>
      )}

      {rootFiles.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Workspace root files</h4>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {rootFiles.map(file => renderFileOption(file))}
          </ul>
        </div>
      )}

      <div>
        {loadingFolders && <div>Loading workspace folders...</div>}
        {!loadingFolders && folders.length === 0 && (
          <div>No folders found in the current workspace.</div>
        )}
        {!loadingFolders && folders.length > 0 && (
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {folders.map(folder => renderFolderRow(folder, 0))}
          </ul>
        )}
      </div>

      <button
        style={{
          alignSelf: 'flex-start',
          padding: '0.6rem 1.2rem',
          fontSize: '0.95rem',
          borderRadius: '4px',
          border: 'none',
          cursor: Object.keys(selectedFilePaths).some(k => selectedFilePaths[k]) ? 'pointer' : 'not-allowed',
          background: Object.keys(selectedFilePaths).some(k => selectedFilePaths[k]) ? '#22c55e' : '#3a3a3a',
          color: Object.keys(selectedFilePaths).some(k => selectedFilePaths[k]) ? '#fff' : '#888'
        }}
        onClick={handleSubmit}
        disabled={!Object.keys(selectedFilePaths).some(k => selectedFilePaths[k])}
      >
        Submit for review
      </button>

      {statusMessage && (
        <div style={{ fontSize: '0.9rem', color: 'var(--vscode-descriptionForeground)' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
