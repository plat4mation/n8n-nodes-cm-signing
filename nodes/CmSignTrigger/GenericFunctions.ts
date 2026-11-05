import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IWebhookFunctions,
} from 'n8n-workflow';

function baseUrl(environment: string): string {
	return environment === 'sandbox'
		? 'https://api.cm.com/sign-sandbox/v1'
		: 'https://api.cm.com/sign/v1';
}

/** Authenticated request helper for the trigger's webhook lifecycle calls. */
export async function cmSignApiRequest(
	this: IHookFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('cmSignApi');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl(credentials.environment as string)}${path}`,
		json: true,
	};

	if (body && Object.keys(body).length > 0) {
		options.body = body;
	}

	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'cmSignApi',
		options,
	)) as IDataObject;
}

/** The kid identifies the client whose webhooks we manage. */
export async function clientKeyId(this: IHookFunctions | IWebhookFunctions): Promise<string> {
	const credentials = await this.getCredentials('cmSignApi');
	return credentials.keyId as string;
}

/** Best-effort HTTP status extraction from an httpRequest rejection. */
export function statusOf(thrown: unknown): number | undefined {
	const e = thrown as {
		httpCode?: string | number;
		statusCode?: number;
		response?: { statusCode?: number };
	};
	const raw = e?.httpCode ?? e?.statusCode ?? e?.response?.statusCode;
	const num = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
	return typeof num === 'number' && Number.isFinite(num) ? num : undefined;
}
