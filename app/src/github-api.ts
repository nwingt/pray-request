const API = "https://api.github.com";
const UA = "PrayRequest";

export function ghHeaders(authToken: string, extra?: Record<string, string>): Record<string, string> {
	return {
		Authorization: `Bearer ${authToken}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": UA,
		...extra,
	};
}

interface Comment {
	id: number;
	body: string;
	user: { login: string; type: string };
}

export async function postComment(
	installationToken: string,
	owner: string,
	repo: string,
	issueNumber: number,
	body: string,
): Promise<void> {
	const r = await fetch(`${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
		method: "POST",
		headers: ghHeaders(installationToken, { "Content-Type": "application/json" }),
		body: JSON.stringify({ body }),
	});
	if (!r.ok) throw new Error(`postComment failed: ${r.status} ${await r.text()}`);
}

// GitHub returns issue comments oldest-first with no documented `direction`
// param — so page 1 is the oldest 100. For typical PRs (<100 comments) the
// bot's previous verse is in there; on busier PRs reroll silently picks the
// same verse. Acceptable for v0; revisit with Link-header pagination or
// GraphQL if it becomes a real complaint.
export async function findLastBotComment(
	installationToken: string,
	owner: string,
	repo: string,
	issueNumber: number,
	botLoginPrefix: string,
): Promise<Comment | null> {
	const r = await fetch(
		`${API}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
		{ headers: ghHeaders(installationToken) },
	);
	if (!r.ok) throw new Error(`listComments failed: ${r.status} ${await r.text()}`);
	const comments = (await r.json()) as Comment[];
	return (
		comments.findLast(
			(c) => c.user.type === "Bot" && c.user.login.startsWith(botLoginPrefix),
		) ?? null
	);
}

interface PullRequest {
	title: string;
	additions: number;
	changed_files: number;
	user: { type: string };
}

export async function getPullRequest(
	installationToken: string,
	owner: string,
	repo: string,
	prNumber: number,
): Promise<PullRequest> {
	const r = await fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
		headers: ghHeaders(installationToken),
	});
	if (!r.ok) throw new Error(`getPullRequest failed: ${r.status} ${await r.text()}`);
	return (await r.json()) as PullRequest;
}

export function extractRefFromBody(body: string): string | null {
	const match = body.match(/<!--\s*prayrequest:ref=(.+?)\s*-->/);
	return match ? match[1].trim() : null;
}
