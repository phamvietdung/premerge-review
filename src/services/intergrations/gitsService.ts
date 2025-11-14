import * as vscode from "vscode";

export async function publishMarkdownToGist(
    content: string,
    filename = "note.md"
) {

    filename = `${filename}.md`

    // Lấy GitHub session đã login
    const session = await vscode.authentication.getSession("github", ["gist"], {
        createIfNone: true,
    });

    try {
        // Dùng fetch global (không cần node-fetch)
        const response = await fetch("https://api.github.com/gists", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                public: true,
                files: {
                    [filename]: { content },
                },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            vscode.window.showErrorMessage(
                // @ts-ignore
                `Failed to create gist: ${data.message}`
            );
            return undefined;
        }
        // @ts-ignore
        const gistUrl = data.html_url;
        vscode.env.clipboard.writeText(gistUrl);
        vscode.window.showInformationMessage(
            `Published to Gist! URL copied to clipboard: ${gistUrl}`
        );
        vscode.env.openExternal(vscode.Uri.parse(gistUrl));
        return gistUrl;
    } catch (err) {
        vscode.window.showErrorMessage(`Error publishing gist: ${err}`);
        return undefined;
    }
}
