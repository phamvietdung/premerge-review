import { h } from 'preact';

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { styles } from '../../styles';

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

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addedFiles, setAddedFiles] = useState<WorkspaceItem[]>([]);

  const WHITELIST = ['cs', 'ts', 'tsx', 'js', 'php', 'java'];

  const isWhitelisted = (file: WorkspaceItem) => {
    const parts = file.name.split('.');
    if (parts.length === 1) return false;
    const ext = parts[parts.length - 1].toLowerCase();
    return WHITELIST.includes(ext);
  };

  const removeAddedFile = useCallback((filePath: string) => {
    setAddedFiles(prev => prev.filter(f => f.path !== filePath));
    setStatusMessage(null);
  }, []);

  const clearAddedFiles = useCallback(() => {
    setAddedFiles([]);
    setStatusMessage(null);
  }, []);

  // Listen for messages from the extension (e.g., fileAdded)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {

      console.log("receive event", event)

      const message = event.data || {};
      if (message.type === 'fileAdded') {
        const filePath = message.filePath as string;
        if (!filePath) return;

        setAddedFiles(prev => {
          if (prev.find(p => p.path === filePath)) return prev;

          const parts = filePath.split(/\\|\//);
          const name = parts.pop() || filePath;
          const dir = parts.join('/');
          const relative = dir ? `${dir}/${name}` : name;

          const item: WorkspaceItem = { name, path: filePath, relativePath: relative };
          setStatusMessage(`Added file to review list: ${name}`);
          return [...prev, item];
        });
      }

      if (message.type === 'fileReviewSubmitted') {
        const filePath = message.filePath as string;
        setStatusMessage(filePath ? `Opened file for review: ${filePath}` : 'Opened file for review');
      }

      if (message.type === 'fileReviewError') {
        setErrorMessage(message.error || 'Unable to open the selected file.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSubmit = useCallback(() => {
    if (addedFiles.length === 0) {
      setStatusMessage('Please add one or more files before submitting.');
      return;
    }

    const filePaths = addedFiles.map(f => f.path);
    setStatusMessage(`Submitting ${filePaths.length} file(s) for review...`);
    setErrorMessage(null);

    if (vscode) {
      vscode.postMessage({ type: 'submitFilesReview', filePaths });
    }
  }, [addedFiles, vscode]);

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

      {/* If there are added files from the command, show them and hide the folder tree */}
      {addedFiles.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Files to review</h4>
          <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            {addedFiles.map(file => (
              <li key={file.path} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{file.name}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--vscode-descriptionForeground)' }}>{file.relativePath}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => removeAddedFile(file.path)} style={{ border: 'none', background: 'transparent', color: 'var(--vscode-foreground)', cursor: 'pointer' }} aria-label="Remove file">Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={clearAddedFiles} style={{ border: 'none', background: '#ef4444', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>Clear list</button>
          </div>
        </div>
      )}

      <button
        style={styles.button}
        disabled={!(addedFiles.length > 0)}
      >
        {addedFiles.length > 0 ? `Submit ${addedFiles.length} file(s) for review` : 'Submit for review'}
      </button>

      {statusMessage && (
        <div style={{ fontSize: '0.9rem', color: 'var(--vscode-descriptionForeground)' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
