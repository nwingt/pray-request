import { Hono } from "hono";
import { verifySignature } from "./verify";
import { handlePullRequest } from "./handlers/pull-request";
import { handleIssueComment } from "./handlers/issue-comment";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("PrayRequest — every PR is a PrayRequest. 🙏"));
app.get("/health", (c) => c.text("ok"));

app.post("/webhook", async (c) => {
	const rawBody = await c.req.text();
	const signature = c.req.header("X-Hub-Signature-256") ?? null;
	const event = c.req.header("X-GitHub-Event") ?? "";
	const delivery = c.req.header("X-GitHub-Delivery") ?? "";

	const ok = await verifySignature(c.env.GITHUB_WEBHOOK_SECRET, rawBody, signature);
	if (!ok) {
		console.warn("rejected webhook: bad signature", { event, delivery });
		return c.text("invalid signature", 401);
	}

	if (event === "ping") return c.json({ pong: true });

	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return c.text("invalid json", 400);
	}

	// Acknowledge fast; do the actual work via waitUntil so GitHub doesn't
	// time out on slow API round-trips. Errors are logged but not surfaced —
	// GitHub's webhook redelivery is opt-in and noisy if we 5xx by accident.
	c.executionCtx.waitUntil(dispatch(event, payload, c.env, delivery));
	return c.json({ accepted: true });
});

async function dispatch(event: string, payload: unknown, env: Env, delivery: string): Promise<void> {
	try {
		if (event === "pull_request") {
			await handlePullRequest(payload as Parameters<typeof handlePullRequest>[0], env);
		} else if (event === "issue_comment") {
			await handleIssueComment(payload as Parameters<typeof handleIssueComment>[0], env);
		}
	} catch (err) {
		console.error("handler error", { event, delivery, err });
	}
}

export default app;
