# PreMerge Review

![Premerge Review](./media/readme-img/logo.png)

**PreMerge Review** is a Visual Studio Code extension that helps developers perform AI-assisted code reviews _before_ merging their feature branches. It generates a smart review prompt from the Git diff between branches, optionally using your team's custom review instructions.

---

## 🚀 Features

- 📍 **Branch Comparison**: Compare your current branch with a target base branch (e.g., `dev`)
- 🧾 **Git Diff Generation**: Generate a full Git diff (`git diff base...feature`)
- 📘 **Custom Instructions**: Read custom instructions from `.github/instructions/`
- ✍️ **AI Review Prompt**: Automatically build a review prompt from diff + instruction
- 🤖 **AI Integration**: Send the prompt to Copilot for review suggestions
- 📊 **Visual Diff Viewer**: Interactive diff viewer with syntax highlighting
- 📤 **Slack Integration**: (Optional) Notify the team with review results via Slack
- 💾 **Export Functionality**: Export diffs to files for sharing

---

## 🛠️ Usage

### Basic Review Workflow

1. **Open Project**: Open any Git-enabled project in VSCode
2. **Open Extension**: Click the **PreMerge Review** tab in the primary sidebar
3. **Select Branches**: 
   - Choose your **current branch** (feature branch)
   - Select your **target branch** (e.g., `dev`, `main`)
   - Optionally select a specific **commit** for more precise comparison
4. **Create Review**: Click **Create Review** to generate diff
5. **View Results**: 
   - Click **Show Details** to open the **Visual Diff Viewer**
   - Click **Process Review** to get AI feedback via Copilot
   - Click **Post to Slack** to share results with your team

### Visual Diff Viewer

The diff viewer provides a comprehensive view of code changes:

- **📂 File Tree**: Navigate through changed files easily
- **🔢 Line Numbers**: Toggle line numbers on/off
- **📋 View Modes**: Switch between unified and split view
- **🎨 Syntax Highlighting**: Color-coded additions, deletions, and context
- **⌨️ Keyboard Shortcuts**: 
  - `Ctrl+S`: Export diff
  - `Ctrl+R`: Refresh viewer
  - `Ctrl+L`: Toggle line numbers
  - `Arrow Keys`: Navigate between files
- **💾 Export**: Save diff to `.diff` or `.patch` files

### Commands Available

- `PreMerge Review: Show Diff Viewer` - Open diff viewer for current review
- `PreMerge Review: Export Diff` - Export current diff to file
- `PreMerge Review: Test Slack Connection` - Test Slack webhook integration
- `PreMerge Review: Show Review Data` - Display current review summary

---

## ⚙️ Configuration

### Extension Settings

Configure the extension via VS Code settings (`Ctrl+,` → search "premerge"):

```json
{
  // Instruction files for review guidance
  "premergeReview.instructionFiles": [
    ".github/instructions.md",
    ".github/review-instructions.md",
    "docs/review-guidelines.md"
  ],
  
  // Maximum size for instruction files (1MB default)
  "premergeReview.maxInstructionFileSize": 1048576,
  
  // Slack webhook URL for notifications
  "premergeReview.slack.webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  
  // Maximum tokens per AI request part
  "premergeReview.maxTokensPerPart": 8000
}
```

### Slack Integration Setup

1. Create a Slack Incoming Webhook:
   - Go to your Slack workspace settings
   - Navigate to **Apps** → **Incoming Webhooks**
   - Create a new webhook for your desired channel
   - Copy the webhook URL

2. Configure in VS Code:
   - Open Settings (`Ctrl+,`)
   - Search for "premergeReview.slack"
   - Paste your webhook URL
   - Test connection using `PreMerge Review: Test Slack Connection`

### Review Instructions

Create instruction files to guide the AI review process:

**`.github/instructions.md`** example:
```markdown
# Code Review Guidelines

## Focus Areas
- Security vulnerabilities
- Performance implications
- Code maintainability
- Test coverage
- Documentation completeness

## Coding Standards
- Follow TypeScript/JavaScript best practices
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Ensure proper error handling

## Specific Checks
- [ ] No hardcoded credentials
- [ ] Proper input validation
- [ ] Memory leak prevention
- [ ] Accessibility compliance
```

---

## 🎯 Use Cases

### 1. **Pre-PR Review**
Review your changes before creating a pull request to catch issues early.

### 2. **Feature Branch Validation**
Validate feature branches against development branch before merging.

### 3. **Code Quality Assurance**
Use AI assistance to maintain consistent code quality across your team.

### 4. **Documentation Review**
Ensure proper documentation and comments accompany code changes.

### 5. **Security Review**
Get AI assistance in identifying potential security vulnerabilities.

---

## 🔧 Technical Requirements

### Essential Requirements
- **VS Code**: Version 1.102.0 or higher
- **Git**: Installed and accessible in PATH
- **GitHub Copilot Extension**: **Required** for AI review functionality
  - Install from VS Code Marketplace: `GitHub.copilot`
  - Must be signed in with valid GitHub Copilot subscription
  - Extension must be active and enabled

### Optional Requirements
- **Slack Webhook**: For team notifications (optional)
- **Node.js**: For development and building (development only)

### GitHub Copilot Setup

1. **Install GitHub Copilot Extension**:
   ```bash
   code --install-extension GitHub.copilot
   ```
   Or search "GitHub Copilot" in VS Code Extensions

2. **Sign In**: Follow prompts to sign in with your GitHub account

3. **Verify Setup**: Check that Copilot is active in VS Code status bar

⚠️ **Important**: Without GitHub Copilot extension, the AI review functionality will not work. The extension will show error messages when trying to process reviews.

---

## 🎨 Visual Features

### Diff Viewer Interface

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Code Review - Diff Viewer                               │
├─────────────────────────────────────────────────────────────┤
│ feature-branch compared to main                             │
│ 📊 3 files changed  +45 lines  -12 lines                  │
│                                                             │
│ [📄 Unified View] [🔢 Show Numbers] [💾 Export] [🔄 Refresh] │
├──────────────┬──────────────────────────────────────────────┤
│ 📂 Files (3) │ file-content.ts                              │
│ ├─ 📘 src/   │ ┌─────────────────────────────────────────┐  │
│ │  ├─ file1  │ │ @@ -15,7 +15,8 @@ function example() │  │
│ │  └─ file2  │ │ - const old = 'value';                  │  │
│ └─ 📋 test/  │ │ + const new = 'updated';                │  │
│    └─ file3  │ │ + const extra = 'added';                │  │
│              │ └─────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
```

### Key Visual Elements

- **🎨 Color Coding**: Green for additions, red for deletions
- **📂 File Navigation**: Expandable file tree with icons
- **🔢 Line Numbers**: Optional line number display
- **📋 Context Lines**: Show surrounding code for better understanding
- **🏷️ File Badges**: NEW, DELETED, BINARY file indicators

---

## 🚦 Getting Started

### Prerequisites Setup

⚠️ **Before using AI review features, ensure GitHub Copilot is installed and active:**

1. **Install GitHub Copilot Extension**:
   - Open VS Code Extensions (`Ctrl+Shift+X`)
   - Search for "GitHub Copilot"
   - Install the official extension by GitHub
   
2. **Sign in and activate**:
   - Follow the sign-in prompts
   - Ensure you have a valid GitHub Copilot subscription
   - Check that Copilot is active (icon in status bar)

### Quick Start

1. **Install PreMerge Review Extension**: Install from VS Code marketplace
2. **Open Git Project**: Open any project with Git repository
3. **Verify Copilot**: Ensure GitHub Copilot extension is active
4. **Access Sidebar**: Look for the PreMerge Review icon in the activity bar
5. **Create First Review**: Select branches and click "Create Review"
6. **Process with AI**: Click "Process Review" for Copilot analysis
7. **Explore Diff**: Click "Show Details" to open the visual diff viewer

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` → "PreMerge" | Open command palette with extension commands |
| `Ctrl+S` (in diff viewer) | Export current diff |
| `Ctrl+R` (in diff viewer) | Refresh diff viewer |
| `Ctrl+L` (in diff viewer) | Toggle line numbers |
| `↑` / `↓` (in diff viewer) | Navigate between files |

---

## 🔍 Troubleshooting

### Common Issues

**"No review data available"**
- Ensure you've created a review first using the sidebar
- Check that your workspace is a valid Git repository

**"Git error" messages**
- Verify Git is installed and accessible
- Ensure you're in a Git repository with commits
- Check that selected branches exist

**GitHub Copilot Issues**
- **Extension not found**: Install GitHub Copilot extension from VS Code Marketplace
- **Not signed in**: Sign in to GitHub with valid Copilot subscription
- **Extension disabled**: Enable GitHub Copilot in Extensions panel
- **Subscription expired**: Verify your GitHub Copilot subscription status
- **Request failures**: Check VS Code Developer Console (`Help` → `Toggle Developer Tools`) for error messages
- **Rate limiting**: Wait a few minutes if you've exceeded API limits

**AI Review not working**
- Ensure GitHub Copilot extension is installed and active (check status bar)
- Verify you're signed in to GitHub with a valid Copilot subscription
- Try restarting VS Code if Copilot stopped responding
- Check that the extension has access to send chat requests

**Slack integration not working**
- Verify webhook URL is correct and active
- Test connection using the "Test Slack Connection" command
- Check Slack workspace permissions

### Performance Tips

- For large diffs, the extension automatically splits requests into manageable parts
- Consider excluding binary files or large assets from review
- Use specific commit ranges for focused reviews

---

## 📸 UI Preview

![Primary sidebar UI](./media/readme-img/primary-sidebar.png)

![Setting UI](./media/readme-img/settings.png)

![Result view UI](./media/readme-img/result.png)

---

## 📈 Roadmap

- [ ] **Multiple AI Providers**: Support for OpenAI, Claude, etc.
- [ ] **Custom Review Templates**: Predefined review types
- [ ] **Team Collaboration**: Share reviews within teams
- [ ] **Review History**: Track and compare previous reviews
- [ ] **Integration**: GitHub/GitLab PR integration
- [ ] **Advanced Filtering**: File type and change size filters

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/premerge-review.git

# Install dependencies
cd premerge-review
npm install

# Build the extension
npm run compile
npm run build-webview

# Run tests
npm test
```

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙋‍♂️ Support

- **Issues**: Report bugs or request features on GitHub
- **Discussions**: Join our community discussions
- **Documentation**: Check our wiki for detailed guides

---

*Happy reviewing! 🚀*
