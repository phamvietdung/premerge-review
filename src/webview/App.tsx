import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import FileReviewTab from './tabs/FileReviewTab';
import { styles } from './styles'
import { CommitReviewTab } from './tabs/CommitReviewTab';

declare global {
    function acquireVsCodeApi(): any;
}

const vscode = acquireVsCodeApi();

function App() {

    const [activeTab, setActiveTab] = useState<'premerge' | 'file'>('premerge');

    useEffect(() => {
        // Listen for git info response
        const handleMessage = (event: any) => {
            const message = event.data;

            console.log("App.tsx Receive Event", message.type, message.data);

            if (message.type === 'gitInfo') {

            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);


    return (
        <div style={styles.container as any}>
            <div style={styles.header as any}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={() => setActiveTab('premerge')}
                        title="Switch to review commit"
                        style={activeTab === 'premerge' ? styles.tabButtonActive as any : styles.tabButtonDeactive as any}
                    >
                        Review Commit
                    </button>

                    <button
                        onClick={() => setActiveTab('file')}
                        title="Switch to review file"
                        style={activeTab === 'file' ? styles.tabButtonActive as any : styles.tabButtonDeactive as any}
                    >
                        Review File
                    </button>
                </div>
            </div>

            {activeTab === 'premerge' && (
                <CommitReviewTab vscode={vscode} />
            )}

            {activeTab === 'file' && (
                <FileReviewTab vscode={vscode} />
            )}

        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    render(<App />, rootElement);
}