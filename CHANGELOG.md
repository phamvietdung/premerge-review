# Change Log

All notable changes to the "premerge-review" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2025-07-20

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