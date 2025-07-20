import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

declare global {
    function acquireVsCodeApi(): any;
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
        fontFamily: 'sans-serif',
        color: '#ffffff',
        backgroundColor: '#1e1e1e',
        height: '100%',
    },
    heading: {
        fontSize: '1.2rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
    },
    label: {
        fontSize: '0.85rem',
        marginBottom: '0.25rem',
        display: 'block',
    },
    select: {
        width: '100%',
        padding: '0.5rem',
        fontSize: '0.9rem',
        backgroundColor: '#2d2d2d',
        color: '#ffffff',
        border: '1px solid #444',
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
        backgroundColor: '#2d2d2d',
        color: '#ffffff',
        border: '1px solid #444',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxSizing: 'border-box',
    },
    arrow: {
        fontSize: '0.8rem',
        color: '#888',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#2d2d2d',
        border: '1px solid #444',
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
        backgroundColor: '#1e1e1e',
        color: '#ffffff',
        border: 'none',
        borderBottom: '1px solid #444',
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
        borderBottom: '1px solid #333',
    },
    selectedOption: {
        backgroundColor: '#007acc',
    },
    noOptions: {
        padding: '0.5rem',
        color: '#888',
        textAlign: 'center',
    },
    button: {
        marginTop: '1.5rem',
        width: '100%',
        padding: '0.6rem',
        fontSize: '0.95rem',
        backgroundColor: '#007acc',
        color: '#ffffff',
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
        color: '#888',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    refreshButton: {
        backgroundColor: '#444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        padding: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    warning: {
        backgroundColor: '#664d00',
        color: '#ffcc00',
        padding: '0.5rem',
        borderRadius: '4px',
        fontSize: '0.85rem',
        marginBottom: '1rem',
        textAlign: 'center',
    },
    // Commit selection styles
    commitSection: {
        marginTop: '1rem',
        padding: '0.75rem',
        backgroundColor: '#2a2a2a',
        borderRadius: '4px',
        border: '1px solid #444',
    },
    loadingText: {
        color: '#888',
        fontSize: '0.8rem',
        fontStyle: 'italic',
    },
    commitCount: {
        color: '#007acc',
        fontSize: '0.8rem',
    },
    selectedCommit: {
        marginTop: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#004d00',
        color: '#00cc00',
        borderRadius: '4px',
        fontSize: '0.85rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: '#666',
        color: '#fff',
        border: 'none',
        borderRadius: '3px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.8rem',
        cursor: 'pointer',
    },
    // Review actions section
    reviewSection: {
        position:'absolute',
        width: '100%',
        bottom: '0',
        left: '0',
        backgroundColor: '#2a2a2a',
        borderTop: '1px solid #444',
        padding: '0.75rem',
        boxSizing: 'border-box',
    },
    reviewSectionTitle: {
        fontSize: '0.9rem',
        fontWeight: 'bold',
        marginBottom: '0.75rem',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    reviewStatus: {
        fontSize: '0.8rem',
        marginBottom: '1rem',
        padding: '0.5rem',
        borderRadius: '4px',
        backgroundColor: '#1a4d1a',
        color: '#4ade80',
        border: '1px solid #22c55e',
    },
    noReviewStatus: {
        fontSize: '0.8rem',
        marginBottom: '1rem',
        padding: '0.5rem',
        borderRadius: '4px',
        backgroundColor: '#4d1a1a',
        color: '#fca5a5',
        border: '1px solid #ef4444',
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
        backgroundColor: '#007acc',
        color: '#ffffff',
    },
    secondaryButton: {
        backgroundColor: '#4a5568',
        color: '#ffffff',
    },
    successButton: {
        backgroundColor: '#059669',
        color: '#ffffff',
    },
    disabledButton: {
        backgroundColor: '#374151',
        color: '#9ca3af',
        cursor: 'not-allowed',
    },
    infoButton: {
        backgroundColor: '#0ea5e9',
        color: '#ffffff',
        border: '1px solid #0284c7',
    },
    settingsButton: {
        backgroundColor: '#6b7280',
        color: '#ffffff',
        border: '1px solid #4b5563',
    },
};

function App() {
    const [currentBranch, setCurrentBranch] = useState('');
    const [baseBranch, setBaseBranch] = useState('');
    const [selectedCommit, setSelectedCommit] = useState('');
    const [commits, setCommits] = useState([]);
    const [gitInfo, setGitInfo] = useState({
        currentBranch: '',
        allBranches: [],
        remoteBranches: [],
        isGitRepo: false
    });
    const [isLoading, setIsLoading] = useState(true);
    const [loadingCommits, setLoadingCommits] = useState(false);

    // Request git info when component mounts
    useEffect(() => {
        // Request git info from extension
        vscode.postMessage({ type: 'requestGitInfo' });

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
        console.log({ currentBranch, baseBranch, selectedCommit });
        // Gửi message tới extension
        vscode.postMessage({
            type: 'createReview',
            data: { currentBranch, baseBranch, selectedCommit }
        });
    };

    const handleRefreshGit = () => {
        setIsLoading(true);
        vscode.postMessage({ type: 'refreshGit' });
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
                <button style={styles.refreshButton as any} onClick={handleRefreshGit} title="Refresh git branches">
                    🔄
                </button>
            </div>

            {!gitInfo.isGitRepo && (
                <div style={styles.warning as any}>
                    ⚠️ Not a Git repository. Using sample data.
                </div>
            )}

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
            </label>
            <SearchableSelect
                options={baseBranchOptions}
                value={baseBranch}
                onChange={setBaseBranch}
                placeholder="Select target branch..."
            />

            <button 
                style={styles.button as any} 
                onClick={handleCreateReview}
                disabled={!currentBranch || (!baseBranch && !selectedCommit)}
            >
                Create Review {selectedCommit ? `(from commit ${selectedCommit.substring(0, 8)})` : `(from ${baseBranch})`}
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