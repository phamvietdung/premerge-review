import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import FileReviewTab from './tabs/FileReviewTab';
import { styles } from '../styles'
import { CommitReviewTab } from './tabs/CommitReviewTab';

declare global {
    function acquireVsCodeApi(): any;
}

const vscode = acquireVsCodeApi();

function App() {

    const [activeTab, setActiveTab] = useState<'premerge' | 'file'>('premerge');


    return (
        <div style={styles.container as any}>
            <div style={styles.header as any}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={() => setActiveTab('premerge')}
                        title="Switch to review commit"
                        style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            border: activeTab === 'premerge' ? '1px solid var(--vscode-list-activeSelectionBackground)' : '1px solid var(--vscode-button-border)',
                            background: activeTab === 'premerge' ? 'var(--vscode-button-background)' : 'transparent',
                            color: 'var(--vscode-button-foreground)',
                            cursor: 'pointer'
                        } as any}
                    >
                        Review Commit
                    </button>

                    <button
                        onClick={() => setActiveTab('file')}
                        title="Switch to review file"
                        style={{
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            border: activeTab === 'file' ? '1px solid var(--vscode-list-activeSelectionBackground)' : '1px solid var(--vscode-button-border)',
                            background: activeTab === 'file' ? 'var(--vscode-button-background)' : 'transparent',
                            color: 'var(--vscode-button-foreground)',
                            cursor: 'pointer'
                        } as any}
                    >
                        Review File
                    </button>
                </div>
            </div>

            {activeTab === 'premerge' && (
                <CommitReviewTab vscode={vscode} />
            )}

            {activeTab === 'file' && (
                <div style={{ marginTop: '1rem' }}>
                    <FileReviewTab vscode={vscode} />
                </div>
            )}

        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    render(<App />, rootElement);
}