# Change Log

All notable changes to the "PreMerge Review" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2025-07-20

### 🎉 **Initial Release**

#### ✨ **Core Features**
- **Smart Branch Comparison**: Compare current branch with any target branch or specific commits
- **AI-Powered Reviews**: GitHub Copilot Chat integration for automated code review feedback
- **Visual Diff Viewer**: Interactive file tree navigation with syntax highlighting and side-by-side comparison
- **Review History Management**: Persistent storage and easy access to previous review results
- **Team Collaboration**: Slack integration with webhook support for notifications

#### 🎨 **User Interface**
- **Activity Bar Integration**: Dedicated PreMerge Review sidebar panel
- **Searchable Branch Selection**: Easy branch and commit selection with search functionality
- **Professional Diff Viewer**: Color-coded changes with file icons and navigation
- **Review History View**: Timeline of all reviews with branch flow visualization

#### 🔧 **Configuration & Customization**
- **Auto-Detection**: Automatic discovery of review instruction files
- **Workspace-Specific Settings**: Per-project configuration support
- **Custom Instructions**: Support for `.github/review-instructions.md` and other patterns
- **Flexible Token Management**: Configurable token limits for large diff handling

#### 📊 **Advanced Features**
- **Multi-Part Review Support**: Intelligent splitting of large diffs for better AI processing
- **Export Functionality**: Save diff results for documentation and sharing
- **Binary File Detection**: Proper handling of binary files in diffs
- **Progress Indicators**: Real-time feedback during review processing

#### 🚀 **Commands & Shortcuts**
- `PreMerge Review: Show Diff Viewer` - Open interactive diff viewer
- `PreMerge Review: Show Review History` - Access review timeline
- `PreMerge Review: Export Diff` - Export current diff to file
- `PreMerge Review: Clear All Review Results` - Clean up review history

#### 🛠️ **Technical Improvements**
- **Modern Architecture**: Built with TypeScript and Preact for optimal performance
- **Robust Error Handling**: Comprehensive error management and user feedback
- **Memory Management**: Efficient storage and retrieval of review data
- **Cross-Platform Support**: Works on Windows, macOS, and Linux

### 🔧 **Configuration Options**

```json
{
  "premergeReview.instructionFiles": ["custom/path/instructions.md"],
  "premergeReview.slack.webhookUrl": "https://hooks.slack.com/...",
  "premergeReview.maxTokensPerPart": 8000,
  "premergeReview.maxInstructionFileSize": 1048576
}
```

### 📋 **Requirements**
- VS Code 1.102.0 or higher
- Git repository with branches
- GitHub Copilot (optional, for AI reviews)
- Slack webhook (optional, for notifications)

### Added
- 🎉 **Visual Diff Viewer**: Interactive diff viewer with syntax highlighting
  - File tree navigation with icons
  - Line numbers toggle
  - Unified/Split view modes
  - Color-coded additions, deletions, and context
  - Binary file detection and display
  - Export diff functionality
  - Keyboard shortcuts for navigation

- 📊 **Enhanced Review Workflow**: 
  - Show Diff Viewer option after creating review
  - Process Review option for AI feedback via Copilot
  - Post to Slack integration
  - Better progress indicators

- ⌨️ **New Commands**:
  - `PreMerge Review: Show Diff Viewer` - Open diff viewer for current review
  - `PreMerge Review: Export Diff` - Export current diff to file

- 🎨 **UI Improvements**:
  - Professional diff viewer interface
  - VS Code theme integration
  - File badges for NEW, DELETED, BINARY files
  - Hover effects and better visual feedback
  - Responsive design for different screen sizes

- 🔧 **Technical Enhancements**:
  - Better error handling and user feedback
  - Improved diff parsing and processing
  - Memory-efficient handling of large diffs
  - Extension context management
  - Service-oriented architecture

### Changed
- Updated review result presentation with new action options
- Enhanced Slack integration with better message formatting
- Improved error messages and user guidance
- Better TypeScript types and interfaces

### Fixed
- Proper extension context passing between services
- Memory leaks in diff processing
- Import/export handling for services
- Git operation error handling

## [Unreleased]

### Planned
- Multiple AI provider support (OpenAI, Claude)
- Custom review templates
- Review history and comparison
- GitHub/GitLab PR integration
- Advanced filtering options