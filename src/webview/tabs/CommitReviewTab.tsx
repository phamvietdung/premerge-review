import { styles } from "../../styles";
import { SearchableSelect } from "../components/SearchableSelect";
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { ChatModel } from "../../models";
import { MessageType } from "../../models/messageTypes";

export function CommitReviewTab(props: { vscode: any }) {

    const { vscode } = props;

    const [currentBranch, setCurrentBranch] = useState('');
    const [baseBranch, setBaseBranch] = useState('');
    const [selectedCommit, setSelectedCommit] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [commits, setCommits] = useState([]);
    const [chatModels, setChatModels] = useState<ChatModel[]>([]);
    const [gitInfo, setGitInfo] = useState({
        currentBranch: '',
        allBranches: [],
        remoteBranches: [],
        isGitRepo: false
    });
    const [isLoading, setIsLoading] = useState(true);
    const [loadingCommits, setLoadingCommits] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const [showManualRefresh, setShowManualRefresh] = useState(false);
    const [intelligentRoutingEnabled, setIntelligentRoutingEnabled] = useState(false);
    const [instructionFolderPath, setInstructionFolderPath] = useState('.github/instructions');
    const [targetBranchStatus, setTargetBranchStatus] = useState<{
        needsPull: boolean;
        message: string;
        error?: string;
    } | null>(null);
    const [checkingTargetBranch, setCheckingTargetBranch] = useState(false);


    // Request git info when component mounts
    useEffect(() => {
        // Request git info and chat models from extension
        vscode.postMessage({ type: MessageType.RequestGitInfo });
        vscode.postMessage({ type: MessageType.RequestChatModels });
        vscode.postMessage({ type: MessageType.RequestSettings });

        // Listen for git info response
        const handleMessage = (event: any) => {
            const message = event.data;
            if (message.type === 'gitInfo') {
                setGitInfo(message.data);
                setCurrentBranch(message.data.currentBranch);
                // Set default base branch with priority order
                const priorityBranches = ['dev', 'main', 'master', 'staging'];
                const defaultBase = priorityBranches.find(branch =>
                    message.data.allBranches.includes(branch)
                ) || message.data.allBranches.find((branch: string) =>
                    branch !== message.data.currentBranch
                ) || '';
                setBaseBranch(defaultBase);
                setIsLoading(false);
            } else if (message.type === 'chatModels') {
                setChatModels(message.data);
                // Handle error if present
                if (message.error) {
                    setModelsError(message.error);
                    setShowManualRefresh(true);
                } else {
                    setModelsError(null);
                    setShowManualRefresh(false);
                    // Set default model (prefer GPT-4o if available)
                    const defaultModel = message.data.find((model: ChatModel) =>
                        model.family === 'gpt-4o' || model.id === 'gpt-4o'
                    ) || message.data[0];
                    if (defaultModel) {
                        setSelectedModel(defaultModel.id);
                    }
                }
                setLoadingModels(false);
            } else if (message.type === 'showManualRefresh') {
                setShowManualRefresh(true);
            } else if (message.type === 'settings') {
                setIntelligentRoutingEnabled(message.data.intelligentRoutingEnabled);
                setInstructionFolderPath(message.data.instructionFolderPath);
            } else if (message.type === 'branchCommits') {
                console.log('Received commits for branch:', message.data.branchName);
                console.log('Received commits for branch:', message.data.commits);
                setCommits(message.data.commits);
                setLoadingCommits(false);
            } else if (message.type === 'reviewCreated') {
                // Review created - no need to track state for this simplified UI
                console.log('Review created:', message.data.summary);
            } else if (message.type === 'reviewDataCleared') {
                // Review data cleared - no need to track state for this simplified UI
                console.log('Review data cleared');
            } else if (message.type === 'targetBranchStatus') {
                setTargetBranchStatus(message.data);
                setCheckingTargetBranch(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Load commits when current branch changes
    useEffect(() => {
        if (currentBranch && gitInfo.isGitRepo) {
            setLoadingCommits(true);
            setSelectedCommit(''); // Clear previous commit selection
            vscode.postMessage({
                type: MessageType.RequestBranchCommits,
                branchName: currentBranch
            });
        }
    }, [currentBranch, gitInfo.isGitRepo]);

    // Check target branch status when baseBranch changes
    useEffect(() => {
        if (baseBranch && gitInfo.isGitRepo) {
            setCheckingTargetBranch(true);
            setTargetBranchStatus(null);
            vscode.postMessage({
                type: 'checkTargetBranch',
                targetBranch: baseBranch
            });
        } else {
            setTargetBranchStatus(null);
        }
    }, [baseBranch, gitInfo.isGitRepo]);

    // Sample branch options (fallback if git fails)
    const fallbackBranchOptions = [
        'dev',
        'main',
        'staging',
        'uat',
        'production',
        'master'
    ];

    const fallbackBaseBranchOptions = [
        'dev',
        'main',
        'master',
        'staging',
        'uat'
    ];

    // Use real git data or fallback
    const branchOptions = gitInfo.isGitRepo && gitInfo.allBranches.length > 0
        ? gitInfo.allBranches
        : fallbackBranchOptions;

    const baseBranchOptions = gitInfo.isGitRepo && gitInfo.allBranches.length > 0
        ? gitInfo.allBranches
        : fallbackBaseBranchOptions;

    const handleCreateReview = () => {
        console.log({ currentBranch, baseBranch, selectedCommit, selectedModel });
        // Gửi message tới extension
        vscode.postMessage({
            type: 'createReview',
            data: { currentBranch, baseBranch, selectedCommit, selectedModel }
        });
    };

    const handleRefreshGit = () => {
        setIsLoading(true);
        vscode.postMessage({ type: 'refreshGit' });
    };

    const handleRefreshModels = () => {
        setLoadingModels(true);
        setModelsError(null);
        setShowManualRefresh(false);
        vscode.postMessage({ type: 'refreshChatModels' });
    };

    const handleShowReviewResult = () => {
        vscode.postMessage({ type: 'showReviewResult' });
    };

    const handleShowSettings = () => {
        // Open VS Code settings for this extension
        vscode.postMessage({
            type: 'openSettings',
            settingId: 'premergeReview'
        });
    };

    if (isLoading) {
        return (
            <div style={styles.container as any}>
                <div style={styles.loading as any}>
                    <div>🔄 Loading git information...</div>
                </div>
            </div>
        );
    }

    // Prepare commit options for select
    const commitOptions = commits.map((commit: any) =>
        `${commit.shortHash} - ${commit.message.split('\n')[0].substring(0, 50)}${commit.message.length > 50 ? '...' : ''}`
    );

    const getCommitHash = (commitOption: string) => {
        const commit = commits.find((c: any) =>
            commitOption.startsWith(c.shortHash)
        ) as any;
        return commit ? commit.hash : '';
    };

    const formatCommitOption = (hash: string) => {
        const commit = commits.find((c: any) => c.hash === hash) as any;
        if (!commit) return hash;
        return `${commit.shortHash} - ${commit.message.split('\n')[0].substring(0, 50)}${commit.message.length > 50 ? '...' : ''}`;
    };

    if (!gitInfo.isGitRepo)
        return (
            <div style={styles.warning as any}>
                ⚠️ Not a Git repository. Using sample data.
            </div>
        );


    return (
        <>
            <label style={styles.label as any}>
                Current Branch {gitInfo.isGitRepo && `(${gitInfo.allBranches.length} branches)`}
            </label>
            <SearchableSelect
                options={branchOptions}
                value={currentBranch}
                onChange={setCurrentBranch}
                placeholder="Select current branch..."
            />

            {/* Commit Selection Section */}
            {currentBranch && gitInfo.isGitRepo && (
                <div style={styles.commitSection as any}>
                    <label style={{ ...styles.label, marginTop: '0.25rem' } as any}>
                        Select Commit (Optional)
                        {loadingCommits && <span style={styles.loadingText as any}> - Loading commits...</span>}
                        {!loadingCommits && commits.length > 0 && <span style={styles.commitCount as any}> - {commits.length} commits loaded</span>}
                    </label>
                    {!loadingCommits && commits.length > 0 && (
                        <SearchableSelect
                            options={commitOptions}
                            value={selectedCommit ? formatCommitOption(selectedCommit) : ''}
                            onChange={(option: any) => setSelectedCommit(getCommitHash(option))}
                            placeholder="Select specific commit (or leave empty to use base branch)..."
                        />
                    )}
                    {selectedCommit && (
                        <div style={styles.selectedCommit as any}>
                            ✓ Selected commit: {selectedCommit.substring(0, 8)}
                            <button
                                style={styles.clearButton as any}
                                onClick={() => setSelectedCommit('')}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}

            <label style={{ ...styles.label, marginTop: '1rem' } as any}>
                Target Branch {selectedCommit ? '(Will be ignored if commit is selected)' : ''} {gitInfo.isGitRepo && `(${gitInfo.allBranches.length} branches available)`}
                {checkingTargetBranch && (
                    <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                        🔄 Checking...
                    </span>
                )}
                {targetBranchStatus && !checkingTargetBranch && targetBranchStatus.needsPull && (
                    <span style={{ color: '#ff8c00', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                        ⚠️ Pull recommended
                    </span>
                )}
            </label>
            <SearchableSelect
                options={baseBranchOptions}
                value={baseBranch}
                onChange={setBaseBranch}
                placeholder="Select target branch..."
            />

            {/* Chat Model Selection and Create Review on one line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' } as any}>
                <div style={{ flex: '1 1 auto', minWidth: 0 } as any}>
                    {/* <label style={styles.label as any}>
                        AI Model for Review {loadingModels ? '(Loading...)' : `(${chatModels.length} models available)`}
                    </label> */}

                    {modelsError && (
                        <div style={styles.warning as any}>
                            ⚠️ Failed to load AI models: {modelsError}
                        </div>
                    )}

                    {showManualRefresh && (
                        <button
                            style={{
                                ...styles.button,
                                backgroundColor: '#f59e0b',
                                marginBottom: '0.5rem'
                            } as any}
                            onClick={handleRefreshModels}
                            disabled={loadingModels}
                        >
                            {loadingModels ? 'Refreshing...' : '🔄 Manual Refresh AI Models'}
                        </button>
                    )}

                    {!loadingModels && chatModels.length > 0 && (
                        <SearchableSelect
                            options={chatModels.map((model: ChatModel) => model.displayName)}
                            value={chatModels.find((model: ChatModel) => model.id === selectedModel)?.displayName || ''}
                            onChange={(displayName: any) => {
                                const model = chatModels.find((m: ChatModel) => m.displayName === displayName);
                                if (model) setSelectedModel(model.id);
                            }}
                            placeholder="Select AI model for code review..."
                        />
                    )}
                    {!loadingModels && chatModels.length === 0 && !showManualRefresh && (
                        <div style={{ maxWidth: '200px', ...styles.warning as any }}>
                            {/* ⚠️ No AI models available. Using default GPT-4o. */}
                            Loading model ...
                        </div>
                    )}
                </div>

                <div style={{ flex: '0 0 auto' } as any}>
                    <button
                        style={{
                            ...styles.button,
                            marginTop: 0,
                            width: 'auto',
                            padding: '0.6rem 1rem'
                        } as any}
                        onClick={handleCreateReview}
                        disabled={!currentBranch || (!baseBranch && !selectedCommit) || !selectedModel}
                    >
                        Create Review 
                        {/* {selectedCommit ? `(from commit ${selectedCommit.substring(0, 8)})` : `(from ${baseBranch})`} with {chatModels.find((model: any) => model.id === selectedModel)?.name || 'AI'} */}
                    </button>
                </div>
            </div>

            {/* Review Actions Section */}
            <div style={styles.reviewSection as any}>
                <div style={styles.reviewActions as any}>
                    <button
                        style={{
                            ...styles.actionButton,
                            ...styles.infoButton
                        } as any}
                        onClick={handleShowReviewResult}
                        title="Show review history and results"
                    >
                        📋 History
                    </button>

                    <button
                        style={{
                            ...styles.actionButton,
                            ...styles.settingsButton
                        } as any}
                        onClick={handleShowSettings}
                        title="Extension settings and configuration"
                    >
                        ⚙️ Settings
                    </button>
                </div>
            </div>
        </>
    )
}