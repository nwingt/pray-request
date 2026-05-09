// Augment the wrangler-generated Env with secrets we set via `wrangler secret put`.
// `wrangler types` doesn't infer these (they aren't declared in wrangler.jsonc),
// so we declare them here. Keep in sync with the secrets listed in app/README.md.
declare namespace Cloudflare {
	interface Env {
		GITHUB_APP_ID: string;
		GITHUB_APP_PRIVATE_KEY: string;
		GITHUB_WEBHOOK_SECRET: string;
	}
}
