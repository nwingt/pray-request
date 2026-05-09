import { SignJWT, importPKCS8 } from "jose";
import { ghHeaders } from "./github-api";

let cachedPrivateKey: { pem: string; key: CryptoKey } | undefined;

async function getPrivateKey(pem: string): Promise<CryptoKey> {
	if (cachedPrivateKey?.pem === pem) return cachedPrivateKey.key;
	const key = (await importPKCS8(pem, "RS256")) as CryptoKey;
	cachedPrivateKey = { pem, key };
	return key;
}

async function getAppJwt(appId: string, privateKeyPkcs8Pem: string): Promise<string> {
	const key = await getPrivateKey(privateKeyPkcs8Pem);
	const now = Math.floor(Date.now() / 1000);
	return await new SignJWT({})
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt(now - 60)
		.setExpirationTime(now + 9 * 60)
		.setIssuer(appId)
		.sign(key);
}

interface CachedToken {
	token: string;
	expiresAtMs: number;
}

// Tokens live 60 min; expire ours at 50 to give a safety buffer.
const installationTokenCache = new Map<number, CachedToken>();

export async function getInstallationToken(
	appId: string,
	privateKeyPkcs8Pem: string,
	installationId: number,
): Promise<string> {
	const cached = installationTokenCache.get(installationId);
	if (cached && cached.expiresAtMs > Date.now()) {
		return cached.token;
	}

	const appJwt = await getAppJwt(appId, privateKeyPkcs8Pem);
	const r = await fetch(
		`https://api.github.com/app/installations/${installationId}/access_tokens`,
		{ method: "POST", headers: ghHeaders(appJwt) },
	);
	if (!r.ok) {
		throw new Error(`installation token request failed: ${r.status} ${await r.text()}`);
	}
	const body = (await r.json()) as { token: string; expires_at: string };

	installationTokenCache.set(installationId, {
		token: body.token,
		expiresAtMs: Date.now() + 50 * 60 * 1000,
	});
	return body.token;
}
