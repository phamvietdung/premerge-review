// Centralized message types for extension <-> webview communication
export enum MessageType {
    RequestBranchCommits = 'requestBranchCommits',
    RequestWorkspaceFolders = 'requestWorkspaceFolders',
    RequestFilesInFolder = 'requestFilesInFolder',
    SubmitFileReview = 'submitFileReview',
    SubmitFilesReview = 'submitFilesReview',
    CreateReview = 'createReview',
    RequestGitInfo = 'requestGitInfo',
    RequestChatModels = 'requestChatModels',
    RefreshChatModels = 'refreshChatModels',
    RequestSettings = 'requestSettings',
    RefreshGit = 'refreshGit',
    CheckTargetBranch = 'checkTargetBranch',
    ShowDiffViewer = 'showDiffViewer',
    ProcessReview = 'processReview',
    PostToSlack = 'postToSlack',
    ShowReviewResult = 'showReviewResult',
    OpenSettings = 'openSettings',
    ClearReviewData = 'clearReviewData',

    // Outgoing types (from extension -> webview)
    BranchCommits = 'branchCommits',
    WorkspaceFolders = 'workspaceFolders',
    FilesInFolder = 'filesInFolder',
    FileReviewSubmitted = 'fileReviewSubmitted',
    FileReviewError = 'fileReviewError',
    ReviewCreated = 'reviewCreated',
    GitInfo = 'gitInfo',
    ChatModels = 'chatModels',
    Settings = 'settings',
    TargetBranchStatus = 'targetBranchStatus',
    ReviewDataCleared = 'reviewDataCleared',
    // File add from extension -> webview
    FileAdded = 'fileAdded',
}

export default MessageType;
