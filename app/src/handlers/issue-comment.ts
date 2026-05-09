import { getInstallationToken } from "../github-auth";
import {
	postComment,
	findLastBotComment,
	getPullRequest,
	extractRefFromBody,
} from "../github-api";
import { pickVerse, formatComment } from "../verse-picker";
import { SUMMON_PATTERN, REROLL_PATTERN, BOT_LOGIN_PREFIX } from "../summon";

interface IssueCommentEvent {
	action: string;
	comment: {
		body: string;
		user: { type: string };
	};
	issue: {
		number: number;
		pull_request?: unknown;
		title: string;
	};
	repository: { name: string; owner: { login: string } };
	installation: { id: number };
}

export async function handleIssueComment(event: IssueCommentEvent, env: Env): Promise<void> {
	if (event.action !== "created") return;
	if (!event.issue.pull_request) return;
	if (event.comment.user.type === "Bot") return;

	const body = event.comment.body;
	const isReroll = REROLL_PATTERN.test(body);
	const isSummon = isReroll || SUMMON_PATTERN.test(body);
	if (!isSummon) return;

	const owner = event.repository.owner.login;
	const repo = event.repository.name;
	const issueNumber = event.issue.number;

	const token = await getInstallationToken(
		env.GITHUB_APP_ID,
		env.GITHUB_APP_PRIVATE_KEY,
		event.installation.id,
	);

	const [pr, last] = await Promise.all([
		getPullRequest(token, owner, repo, issueNumber),
		isReroll
			? findLastBotComment(token, owner, repo, issueNumber, BOT_LOGIN_PREFIX)
			: Promise.resolve(null),
	]);

	const excludeRef = last ? (extractRefFromBody(last.body) ?? undefined) : undefined;

	const verse = pickVerse({
		prTitle: pr.title,
		additions: pr.additions,
		changedFiles: pr.changed_files,
		excludeRef,
	});

	await postComment(token, owner, repo, issueNumber, formatComment(verse));
}
