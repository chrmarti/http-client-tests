import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "http-client-tests" is now active!');

	const disposable = vscode.commands.registerCommand('http-client-tests.test', async () => {
		const test = require('../../fetch-streaming-client.js');
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Running fetch test...",
			cancellable: false
		}, async (progress) => {
			const stats = await test.streamWithFetch();
			const text = `Fetch stats (chunk length -> count / ttfb ms -> count): ${JSON.stringify(stats.node, null, 2)}`;
			const document = await vscode.workspace.openTextDocument({ content: text });
			await vscode.window.showTextDocument(document);
		});
	});

	context.subscriptions.push(disposable);
}
