import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type ReviewList = string[];

async function readReviewList(storePath: string): Promise<ReviewList> {
  try {
    const buf = await fs.promises.readFile(storePath, 'utf8');
    const arr = JSON.parse(buf);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

async function writeReviewList(storePath: string, list: ReviewList) {
  await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
  const pretty = JSON.stringify([...new Set(list)].sort(), null, 2);
  await fs.promises.writeFile(storePath, pretty, 'utf8');
}

function resolveStorePath(): string | undefined {
  const cfg = vscode.workspace.getConfiguration('fileReview');
  let store = cfg.get<string>('store');
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder || !store) return undefined;

  // expand ${workspaceFolder}
  store = store.replace('${workspaceFolder}', wsFolder.uri.fsPath);
  return store;
}

/**
 * Lấy danh sách URI từ:
 * - Explorer context menu (được VS Code truyền vào: uri, uris)
 * - Hoặc từ editor đang mở nếu gọi qua Command Palette
 */
function collectUris(uri?: vscode.Uri, uris?: vscode.Uri[]): vscode.Uri[] {
  if (uris && uris.length) return uris;
  if (uri) return [uri];
  const active = vscode.window.activeTextEditor?.document.uri;
  return active ? [active] : [];
}

export function activate(context: vscode.ExtensionContext) {
  const addCmd = vscode.commands.registerCommand(
    'fileReview.add',
    async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
      const targets = collectUris(uri, uris).filter(u => u.scheme === 'file');
      if (targets.length === 0) {
        vscode.window.showInformationMessage('Không có file nào được chọn.');
        return;
      }

      const storePath = resolveStorePath();
      if (!storePath) {
        vscode.window.showErrorMessage('Không xác định được file lưu danh sách (.file-review.json).');
        return;
      }

      const list = await readReviewList(storePath);
      targets.forEach(u => list.push(u.fsPath));

      await writeReviewList(storePath, list);

      const rel = (p: string) =>
        vscode.workspace.asRelativePath(p, false);

      vscode.window.showInformationMessage(
        `Đã thêm ${targets.length} file vào File Review:\n` +
        targets.slice(0, 5).map(u => '• ' + rel(u.fsPath)).join('\n') +
        (targets.length > 5 ? `\n... (+${targets.length - 5} files)` : '')
      );
    }
  );

  const showCmd = vscode.commands.registerCommand(
    'fileReview.showList',
    async () => {
      const storePath = resolveStorePath();
      if (!storePath) {
        vscode.window.showErrorMessage('Không xác định được file lưu danh sách.');
        return;
      }
      const list = await readReviewList(storePath);
      if (list.length === 0) {
        vscode.window.showInformationMessage('Danh sách File Review đang trống.');
        return;
      }

      const picks = await vscode.window.showQuickPick(
        list.map(p => ({
          label: path.basename(p),
          description: vscode.workspace.asRelativePath(p, false),
          full: p
        })), { canPickMany: false, placeHolder: 'Chọn file để mở' }
      );

      if (picks?.full) {
        const doc = await vscode.workspace.openTextDocument(picks.full);
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    }
  );

  context.subscriptions.push(addCmd, showCmd);
}

export function deactivate() {}
