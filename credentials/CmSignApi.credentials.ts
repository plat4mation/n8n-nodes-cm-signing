import { createHmac } from 'node:crypto';
import type {
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

function base64url(input: Buffer | string): string {
	// typeof, not `input instanceof Buffer`: instanceof leaves the negative
	// branch typed `string | Buffer<ArrayBufferLike>`, which matches no
	// Buffer.from overload (TS2769). Narrowing on the string side compiles
	// without a type assertion.
	return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url');
}

/**
 * Mint a CM.com Sign JWT. CM issues credentials, not tokens: the client signs
 * its own short-lived JWT per request with HS256, carrying the Key ID as `kid`
 * in the header and iat/nbf/exp in the payload.
 *
 * `nbf` is backdated 30s to absorb clock skew between this host and CM; the
 * 5-minute lifetime is long enough for a slow multipart upload and short
 * enough to limit the value of a captured token.
 */
function signJwt(keyId: string, secret: string): string {
	const now = Math.floor(Date.now() / 1000);
	const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: keyId }));
	const payload = base64url(JSON.stringify({ iat: now, nbf: now - 30, exp: now + 300 }));
	const signingInput = `${header}.${payload}`;
	const signature = base64url(createHmac('sha256', secret).update(signingInput).digest());
	return `${signingInput}.${signature}`;
}

export class CmSignApi implements ICredentialType {
	name = 'cmSignApi';

	displayName = 'CM Sign API';

	icon: Icon = { light: 'file:../icons/cmSign.svg', dark: 'file:../icons/cmSign.dark.svg' };

	documentationUrl = 'https://developers.cm.com/sign/docs/getting-started';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Production', value: 'production' },
				{ name: 'Sandbox', value: 'sandbox' },
			],
			default: 'sandbox',
			description:
				'Which CM.com Sign environment to call. Defaults to sandbox; switch to production only once your flow is verified, because production requests send real signing invitations.',
		},
		{
			displayName: 'Key ID',
			name: 'keyId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 8f14e45f-ea0c-4b4f-9b2a-2d1c5e7a90bd',
			description:
				'Key ID from your CM.com Sign API credentials. Sent as the kid header of each signed token.',
		},
		{
			displayName: 'Secret',
			name: 'secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Secret from your CM.com Sign API credentials. Used to sign each token and never sent to CM.com.',
		},
	];

	/**
	 * Custom authenticate: IAuthenticateGeneric cannot compute an HMAC, and
	 * preAuthentication is for exchanging credentials for a server-issued
	 * token — CM issues none. Running per request also means the token is
	 * always fresh, so expiry never needs tracking.
	 */
	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const token = signJwt(credentials.keyId as string, credentials.secret as string);
		requestOptions.headers = { ...requestOptions.headers, Authorization: `Bearer ${token}` };
		return requestOptions;
	}

	/**
	 * GET /templates is a plain tenant-scoped read, confirmed 200 for a normal
	 * key. A wrong secret yields a token CM cannot verify (401), so this still
	 * validates the secret and not just the Key ID.
	 *
	 * Do NOT use GET /clients/{kid}: a valid production key returns
	 * 403 No permission there, which would reject working credentials.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.environment === "sandbox" ? "https://api.cm.com/sign-sandbox/v1" : "https://api.cm.com/sign/v1"}}',
			url: '/templates',
			method: 'GET',
		},
	};
}
