import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';

/**
 * Populate the Dossier resourceLocator's From List mode.
 *
 * GET /dossiers returns a bare array of every dossier; adding ?page=N instead
 * returns a {total, …, data} envelope. Both shapes are handled. The API
 * ignores search/name/state query parameters — it answers with the full list
 * either way — so the caller's filter is applied here, not server-side.
 */
export async function searchDossiers(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const credentials = await this.getCredentials('cmSignApi');
	const baseURL =
		credentials.environment === 'sandbox'
			? 'https://api.cm.com/sign-sandbox/v1'
			: 'https://api.cm.com/sign/v1';

	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'cmSignApi', {
		method: 'GET',
		url: `${baseURL}/dossiers`,
		json: true,
	})) as IDataObject | IDataObject[];

	const dossiers = (
		Array.isArray(response) ? response : ((response.data as IDataObject[]) ?? [])
	) as Array<{ id?: string; name?: string; state?: string }>;

	const needle = filter?.toLowerCase().trim();

	const results: INodeListSearchItems[] = dossiers
		.filter((d) => typeof d.id === 'string')
		.filter((d) => !needle || (d.name ?? '').toLowerCase().includes(needle))
		.map((d) => ({
			name: d.state ? `${d.name ?? d.id} (${d.state})` : (d.name ?? (d.id as string)),
			value: d.id as string,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { results };
}
