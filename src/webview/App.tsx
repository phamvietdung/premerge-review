import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import FileReviewTab, { SelectedFile } from './tabs/FileReviewTab';
import { styles } from './styles'
import { CommitReviewTab } from './tabs/CommitReviewTab';
import { ChatModel } from '../models';
import MessageType from '../models/messageTypes';

declare global {
    function acquireVsCodeApi(): any;
}

const vscode = acquireVsCodeApi();

export type AppState = {
    activeTab: 'premerge' | 'file',
    selectedFiles: SelectedFile[],
    chatModes: ChatModel[],
    selectedModel: string
}

export const defaultState: AppState = {
    activeTab: 'premerge',
    selectedFiles: [],
    chatModes: [],
    selectedModel: ''
}

function App() {

    const initialStateRef = useRef<AppState>(vscode.getState() as AppState ?? defaultState);

    const [activeTab, setActiveTab] = useState<'premerge' | 'file'>(initialStateRef.current.activeTab);

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>(initialStateRef.current.selectedFiles ?? []);

    const [chatModels, setChatModels] = useState<ChatModel[]>(initialStateRef.current.chatModes ?? []);

    const [selectedModel, setSelectedModel] = useState(initialStateRef.current.selectedModel ?? '');

    const [loadingModels, setLoadingModels] = useState(false);

    const getTheme = () => {
        if (document.body.classList.contains('vscode-dark')) return 'dark';
        if (document.body.classList.contains('vscode-light')) return 'light';
        return 'high-contrast';
    };

    const [theme, setTheme] = useState(getTheme())

    useEffect(() => {
        vscode.postMessage({ type: MessageType.RequestChatModels });

        const handleMessage = (event: any) => {
            const message = event.data;
            if (message.type === 'chatModels') {
                setChatModels(message.data);
                // Handle error if present
                if (message.error) {
                    // setModelsError(message.error);
                    // setShowManualRefresh(true);
                } else {
                    // setModelsError(null);
                    // setShowManualRefresh(false);
                    // Set default model (prefer GPT-4o if available)
                    const defaultModel = message.data.find((model: ChatModel) =>
                        model.family === 'gpt-4o' || model.id === 'gpt-4o'
                    ) || message.data[0];
                    if (defaultModel) {
                        // setSelectedModel(defaultModel.id);
                    }
                }
                // setLoadingModels(false);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [])

    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(getTheme()));
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const nextState = { ...initialStateRef.current, selectedModel };
        initialStateRef.current = nextState;
        vscode.setState(nextState);
    }, [selectedModel]);

    useEffect(() => {
        const nextState = { ...initialStateRef.current, activeTab };
        initialStateRef.current = nextState;
        vscode.setState(nextState);
    }, [activeTab]);

    useEffect(() => {
        const nextState = { ...initialStateRef.current, selectedFiles };
        initialStateRef.current = nextState;
        vscode.setState(nextState);
    }, [selectedFiles]);

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
                <CommitReviewTab
                    chatModels={chatModels}
                    setChatModels={setChatModels}
                    loadingModels={loadingModels}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    theme={theme}
                    vscode={vscode} />
            )}

            {activeTab === 'file' && (
                <FileReviewTab
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    chatModels={chatModels}
                    loadingModels={loadingModels}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    theme={theme}
                    vscode={vscode} />
            )}

        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    render(<App />, rootElement);
}