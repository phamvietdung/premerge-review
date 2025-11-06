import { h } from 'preact';

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { styles } from '../styles';

interface FileReviewTabProps {
  vscode: any;
}

type FileChunk = {
  name: string;
  text: string;
  startLine: number;
  endLine: number;
};

type SelectedFile = {
  path: string;
  language?: string;
  chunks?: FileChunk[];
};

// NOTE: This component assumes the extension side of the webview will
// accept/emit the following messages (reasonable assumptions):
// - postMessage({ type: 'searchFiles', query }) -> window posts back { type: 'searchFilesResult', results: [{ path }] }
// - postMessage({ type: 'requestFileContent', path }) -> window posts back { type: 'fileContent', path, content }
// - postMessage({ type: 'createReview', data }) to create a review (we follow CommitReviewTab pattern)

export default function FileReviewTab({ vscode }: FileReviewTabProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const searchedByEnterRef = useRef(false);

  useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      if (!message || !message.type) return;

      if (message.type === 'searchFilesResult') {
        // results: array of file paths
        const results = Array.isArray(message.results) ? message.results : [];
        setSearchResults(results);
        setLoadingSearch(false);

        // If this search was triggered by Enter and exactly one match, auto-add it.
        if (searchedByEnterRef.current && results.length === 1) {
          addFile(results[0]);
          setQuery('');
          setSearchResults([]);
        }
        searchedByEnterRef.current = false;
      } else if (message.type === 'fileContent') {
        const { path, content } = message;
        // simple language detection by extension
  const lang = path.endsWith('.cs') ? 'csharp' : undefined;
  // Temporarily treat whole file as one chunk; splitting logic will be added later
  const chunks = [{ name: path, text: content, startLine: 1, endLine: content.split('\n').length }];

        setSelectedFiles(prev => prev.map(f => f.path === path ? { ...f, language: lang, chunks } : f));
        setLoadingFiles(prev => ({ ...prev, [path]: false }));
      } else if (message.type === 'reviewCreated') {
        // extension signaled review created — clear selection
        setSelectedFiles([]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const runSearch = useCallback((q: string) => {
    const tq = (q || '').trim();
    if (!tq) return;
    setLoadingSearch(true);
    setSearchResults([]);
    // Delegate search to extension (use VS Code workspace search there)
    vscode.postMessage({ type: 'searchFiles', query: tq });
  }, [vscode]);

  const addFile = useCallback((path: string) => {
    if (!path) return;
    // avoid duplicates
    setSelectedFiles(prev => {
      if (prev.find(p => p.path === path)) return prev;
      return [...prev, { path }];
    });

    // request file content for chunking and analysis
    setLoadingFiles(prev => ({ ...prev, [path]: true }));
    vscode.postMessage({ type: 'requestFileContent', path });
  }, [vscode]);

  const removeFile = useCallback((path: string) => {
    setSelectedFiles(prev => prev.filter(p => p.path !== path));
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    // If user presses Enter in the input, perform search and if single match, add it
    if ((e as any).key === 'Enter') {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      // mark that this search was initiated by pressing Enter so we can auto-add if there's a single result
      searchedByEnterRef.current = true;
      runSearch(q);
    }
  };

  // (Intentionally no automatic add on plain result update — only add when search was triggered by Enter.)

  const handleSelectResult = (path: string) => {
    addFile(path);
    setQuery('');
    setSearchResults([]);
  };

  const getBaseName = (p: string) => {
    if (!p) return '';
    const parts = p.split(/[\\\/]/);
    return parts[parts.length - 1] || p;
  };

  const handleSubmitReview = () => {
    // Build review payload. For each selected file include path and chunks (if available)
    const payload = selectedFiles.map(f => ({ path: f.path, language: f.language || null, chunks: f.chunks || null }));
    vscode.postMessage({ type: 'createReview', data: { files: payload } });
  };

  return (
    <div>
      <label style={styles.label as any}>Add file by name (paste filename and press Enter)</label>
      <input
        style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' } as any}
        value={query}
        onInput={(e: any) => setQuery(e.target.value)}
        onKeyDown={(e: any) => handleKeyDown(e)}
        placeholder="e.g. Controllers/UserController.cs or Program.cs"
      />

      {loadingSearch && <div style={{ marginTop: '0.5rem' as any }}>🔍 Searching workspace...</div>}

      {searchResults.length > 0 && (
        <div style={{ marginTop: '0.5rem' as any }}>
          <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' as any }}>
            Matches:
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '60vh', minHeight: '400px', overflowY: 'auto' } as any}>
            {searchResults.map((p) => (
                <li key={p} style={{ marginBottom: '0.25rem' as any }}>
                  <button style={{ ...styles.tabButtonDeactive, width: '100%', textAlign: 'left', padding: '0.5rem' } as any} onClick={() => handleSelectResult(p)}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{getBaseName(p)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--vscode-descriptionForeground)', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{p}</div>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '1rem' as any }}>
        <div style={{ fontWeight: 600 } as any}>Files to review</div>
        {selectedFiles.length === 0 && <div style={{ ...styles.warning as any, marginTop: '0.5rem' }}>No files selected</div>}
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' as any }}>
          {selectedFiles.map(f => (
            <li key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' } as any}>
              <div style={{ flex: '1 1 auto', minWidth: 0 } as any}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{getBaseName(f.path)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--vscode-descriptionForeground)', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any}>{f.path}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--vscode-descriptionForeground)', marginTop: '0.25rem' } as any}>
                  {loadingFiles[f.path] ? 'Loading file...' : (f.chunks ? `${f.chunks.length} chunk(s)` : 'Waiting for content')}
                </div>
              </div>
              <div style={{ flex: '0 0 auto' } as any}>
                <button style={{ ...styles.clearButton } as any} onClick={() => removeFile(f.path)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '1rem' as any }}>
        <button
          style={{ ...styles.button } as any}
          onClick={handleSubmitReview}
          disabled={selectedFiles.length === 0}
        >
          Submit Review
        </button>
      </div>
    </div>
  );
}

// Note: C# chunking logic removed temporarily. We will review whole files for now and implement splitting later.
