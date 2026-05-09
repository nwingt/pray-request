import { getInstallationToken } from "../github-auth";
import { postComment } from "../github-api";
import { pickVerse, formatComment } from "../verse-picker";

interface PullRequestEvent {
	action: string;
	pull_request: {
		number: number;
		title: string;
		additions: number;
		changed_files: number;
		user: { type: string };
		draft: boolean;
	};
	repository: { name: string; owner: { login: string } };
	installation: { id: number };
}

export async function handlePullRequest(event: PullRequestEvent, env: Env): Promise<void> {
	if (event.action !== "opened" && event.action !== "ready_for_review") return;
	if (event.pull_request.draft && event.action === "opened") return;
	if (event.pull_request.user.type === "Bot") return;
	if (event.pull_request.title.includes("[skip prayrequest]")) return;

	const verse = pickVerse({
		prTitle: event.pull_request.title,
		additions: event.pull_request.additions,
		changedFiles: event.pull_request.changed_files,
	});

	const token = await getInstallationToken(
		env.GITHUB_APP_ID,
		env.GITHUB_APP_PRIVATE_KEY,
		event.installation.id,
	);
	await postComment(
		token,
		event.repository.owner.login,
		event.repository.name,
		event.pull_request.number,
		formatComment(verse),
	);
}
