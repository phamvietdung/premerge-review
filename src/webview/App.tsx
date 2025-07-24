import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

declare global {
    function acquireVsCodeApi(): any;
}

interface ChatModel {
    id: string;
    name: string;
    vendor: string;
    family: string;
    version: string;
    maxInputTokens: number;
    displayName: string;
}

const vscode = acquireVsCodeApi();

function SearchableSelect({ options, value, onChange, placeholder = "Select..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredOptions, setFilteredOptions] = useState(options);
    const containerRef = useRef(null);

    useEffect(() => {
        const filtered = options.filter(option =>
            option.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredOptions(filtered);
    }, [searchTerm, options]);

    useEffect(() => {
        function handleClickOutside(event) {
            const container = containerRef.current as unknown as HTMLElement;
            if (container && container.contains && !container.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div style={styles.selectContainer as any} ref={containerRef}>
            <div
                style={styles.selectDisplay as any}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{value || placeholder}</span>
                <span style={styles.arrow as any}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
                <div style={styles.dropdown as any}>
                    <input
                        style={styles.searchInput as any}
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <div style={styles.optionsList as any}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    style={{
                                        ...styles.option,
                                        ...(value === option ? styles.selectedOption : {})
                                    } as any}
                                    onClick={() => handleSelect(option)}
                                >
                                    {option}
                                </div>
                            ))
                        ) : (
                            <div style={styles.noOptions as any}>No options found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '1rem',
        fontFamily: 'var(--vscode-font-family)',
        color: 'var(--vscode-foreground)',
        backgroundColor: 'var(--vscode-editor-background)',
        height: '100%',
    },
    heading: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        color: 'var(--vscode-foreground)',
    },
    label: {
        fontSize: '0.85rem',
        marginBottom: '0.25rem',
        display: 'block',
        color: 'var(--vscode-foreground)',
    },
    select: {
        width: '100%',
        padding: '0.5rem',
        fontSize: '0.9rem',
        backgroundColor: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: '4px',
    },
    selectContainer: {
        position: 'relative',
        width: '100%',
    },
    selectDisplay: {
        width: '100%',
        padding: '0.5rem',
        fontSize: '0.9rem',
        backgroundColor: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxSizing: 'border-box',
    },
    arrow: {
        fontSize: '0.8rem',
        color: 'var(--vscode-descriptionForeground)',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'var(--vscode-dropdown-background)',
        border: '1px solid var(--vscode-dropdown-border)',
        borderTop: 'none',
        borderRadius: '0 0 4px 4px',
        zIndex: 1000,
        maxHeight: '200px',
        overflow: 'hidden',
    },
    searchInput: {
        width: '100%',
        padding: '0.5rem',
        fontSize: '0.9rem',
        backgroundColor: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: 'none',
        borderBottom: '1px solid var(--vscode-input-border)',
        outline: 'none',
        boxSizing: 'border-box',
    },
    optionsList: {
        maxHeight: '150px',
        overflowY: 'auto',
    },
    option: {
        padding: '0.5rem',
        cursor: 'pointer',
        borderBottom: '1px solid var(--vscode-widget-border)',
        color: 'var(--vscode-foreground)',
    },
    selectedOption: {
        backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
        color: 'var(--vscode-list-activeSelectionForeground)',
    },
    noOptions: {
        padding: '0.5rem',
        color: 'var(--vscode-descriptionForeground)',
        textAlign: 'center',
    },
    button: {
        marginTop: '1.5rem',
        width: '100%',
        padding: '0.6rem',
        fontSize: '0.95rem',
        backgroundColor: 'var(--vscode-button-background)',
        color: 'var(--vscode-button-foreground)',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    // New styles for git integration
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100px',
        fontSize: '0.9rem',
        color: 'var(--vscode-descriptionForeground)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    refreshButton: {
        backgroundColor: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)',
        border: '1px solid var(--vscode-button-border)',
        borderRadius: '4px',
        padding: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    warning: {
        backgroundColor: 'var(--vscode-editorWarning-background)',
        color: 'var(--vscode-editorWarning-foreground)',
        padding: '0.5rem',
        borderRadius: '4px',
        fontSize: '0.85rem',
        marginBottom: '1rem',
        textAlign: 'center',
        border: '1px solid var(--vscode-editorWarning-border)',
    },
    // Commit selection styles
    commitSection: {
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: 'var(--vscode-editorWidget-background)',
        borderRadius: '4px',
        border: '1px solid var(--vscode-widget-border, var(--vscode-contrastBorder, #444))',
    },
    loadingText: {
        color: 'var(--vscode-descriptionForeground)',
        fontSize: '0.8rem',
        fontStyle: 'italic',
    },
    commitCount: {
        color: 'var(--vscode-textLink-foreground)',
        fontSize: '0.8rem',
    },
    selectedCommit: {
        marginTop: '0.5rem',
        padding: '0.5rem',
        backgroundColor: 'var(--vscode-list-activeSelectionBackground)',
        color: 'var(--vscode-list-activeSelectionForeground)',
        borderRadius: '4px',
        fontSize: '0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid var(--vscode-contrastActiveBorder, var(--vscode-list-activeSelectionBackground))',
    },
    clearButton: {
        backgroundColor: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)',
        border: '1px solid var(--vscode-button-border)',
        borderRadius: '3px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.8rem',
        cursor: 'pointer',
    },
    // Intelligent routing info
    intelligentRoutingInfo: {
        backgroundColor: 'var(--vscode-editorInfo-background)',
        color: 'var(--vscode-editorInfo-foreground)',
        padding: '0.5rem',
        borderRadius: '4px',
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        border: '1px solid var(--vscode-editorInfo-border, var(--vscode-editorInfo-foreground, #22c55e))',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
    },
    intelligentRoutingWarning: {
        backgroundColor: 'var(--vscode-editorWarning-background)',
        color: 'var(--vscode-editorWarning-foreground)',
        padding: '0.5rem',
        borderRadius: '4px',
        fontSize: '0.65rem',
        marginBottom: '0.5rem',
        border: '1px solid var(--vscode-editorWarning-border, var(--vscode-contrastBorder, #f59e0b))',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
    },
    // Review actions section
    reviewSection: {
        position: 'absolute',
        width: '100%',
        bottom: '0',
        left: '0',
        backgroundColor: 'var(--vscode-editorWidget-background)',
        borderTop: '1px solid var(--vscode-widget-border)',
        padding: '0.75rem',
        boxSizing: 'border-box',
    },
    reviewSectionTitle: {
        fontSize: '0.9rem',
        fontWeight: 'bold',
        marginBottom: '0.75rem',
        color: 'var(--vscode-foreground)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    reviewStatus: {
        fontSize: '0.8rem',
        marginBottom: '1rem',
        padding: '0.5rem',
        borderRadius: '4px',
        backgroundColor: 'var(--vscode-editorInfo-background)',
        color: 'var(--vscode-editorInfo-foreground)',
        border: '1px solid var(--vscode-editorInfo-border)',
    },
    noReviewStatus: {
        fontSize: '0.8rem',
        marginBottom: '1rem',
        padding: '0.5rem',
        borderRadius: '4px',
        backgroundColor: 'var(--vscode-editorError-background)',
        color: 'var(--vscode-editorError-foreground)',
        border: '1px solid var(--vscode-editorError-border)',
    },
    reviewActions: {
        display: 'flex',
        flexDirection: 'row',
        gap: '0.5rem',
        justifyContent: 'space-between',
    },
    actionButton: {
        padding: '0.6rem 0.75rem',
        fontSize: '0.85rem',
        fontWeight: '500',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        flex: 1, // Make buttons take equal width
        minHeight: '40px',
    },
    primaryButton: {
        backgroundColor: 'var(--vscode-button-background)',
        color: 'var(--vscode-button-foreground)',
    },
    secondaryButton: {
        backgroundColor: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)',
    },
    successButton: {
        backgroundColor: 'var(--vscode-testing-iconPassed)',
        color: 'var(--vscode-button-foreground)',
    },
    disabledButton: {
        backgroundColor: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-disabledForeground)',
        cursor: 'not-allowed',
        opacity: '0.6',
    },
    infoButton: {
        backgroundColor: 'var(--vscode-button-background)',
        color: 'var(--vscode-button-foreground)',
        border: '1px solid var(--vscode-button-border)',
    },
    settingsButton: {
        backgroundColor: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)',
        border: '1px solid var(--vscode-button-border)',
    },
};

function App() {
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
        vscode.postMessage({ type: 'requestGitInfo' });
        vscode.postMessage({ type: 'requestChatModels' });
        vscode.postMessage({ type: 'requestSettings' });

        // Listen for git info response
        const handleMessage = (event) => {
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
                type: 'requestBranchCommits',
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
        'ticket-1234_update_product',
        'ticket-4567_fix_order',
        'feature/new-dashboard',
        'bugfix/payment-issue',
        'hotfix/security-patch',
        'dev',
        'main',
        'staging',
        'release/v2.0.0'
    ];

    const fallbackBaseBranchOptions = [
        'dev',
        'main',
        'master',
        'staging',
        'release/v2.0.0',
        'feature/new-dashboard',
        'hotfix/security-patch'
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

    return (
        <div style={styles.container as any}>
            <div style={styles.header as any}>
                <h2 style={styles.heading as any}>Premerge Review Extensions</h2>
                {/* <button style={styles.refreshButton as any} onClick={handleRefreshGit} title="Refresh git branches">
                    Intelligent mode
                </button> */}
                {intelligentRoutingEnabled ? (
                    <div style={styles.intelligentRoutingInfo as any}>
                        <div>
                            <strong>Intelligent Routing Mode</strong>
                            {/* <br /> */}
                            {/* AI will analyze your changes and automatically select relevant instructions from: <code>{instructionFolderPath}</code> */}
                        </div>
                    </div>
                ) : (
                    <div style={styles.intelligentRoutingWarning as any}>
                        <div>
                            <strong>Traditional Instructions Mode</strong>
                            {/* <br /> */}
                            {/* Using all available instructions. Enable intelligent routing in settings for AI-powered instruction selection.
                        <br /><em>Note: Intelligent routing uses additional AI requests.</em> */}
                        </div>
                    </div>
                )}
            </div>

            {!gitInfo.isGitRepo && (
                <div style={styles.warning as any}>
                    ⚠️ Not a Git repository. Using sample data.
                </div>
            )}

            {/* Intelligent Routing Info */}


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
                    <label style={{ ...styles.label, marginTop: '1rem' } as any}>
                        Select Commit (Optional)
                        {loadingCommits && <span style={styles.loadingText as any}> - Loading commits...</span>}
                        {!loadingCommits && commits.length > 0 && <span style={styles.commitCount as any}> - {commits.length} commits loaded</span>}
                    </label>
                    {!loadingCommits && commits.length > 0 && (
                        <SearchableSelect
                            options={commitOptions}
                            value={selectedCommit ? formatCommitOption(selectedCommit) : ''}
                            onChange={(option) => setSelectedCommit(getCommitHash(option))}
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

            {/* Chat Model Selection */}
            <label style={{ ...styles.label, marginTop: '1rem' } as any}>
                AI Model for Review {loadingModels ? '(Loading...)' : `(${chatModels.length} models available)`}
            </label>

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
                    onChange={(displayName) => {
                        const model = chatModels.find((m: ChatModel) => m.displayName === displayName);
                        if (model) setSelectedModel(model.id);
                    }}
                    placeholder="Select AI model for code review..."
                />
            )}
            {!loadingModels && chatModels.length === 0 && !showManualRefresh && (
                <div style={styles.warning as any}>
                    ⚠️ No AI models available. Using default GPT-4o.
                </div>
            )}

            <button
                style={styles.button as any}
                onClick={handleCreateReview}
                disabled={!currentBranch || (!baseBranch && !selectedCommit) || !selectedModel}
            >
                Create Review {selectedCommit ? `(from commit ${selectedCommit.substring(0, 8)})` : `(from ${baseBranch})`} with {chatModels.find((model: any) => model.id === selectedModel)?.name || 'AI'}
            </button>

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
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    render(<App />, rootElement);
}