import type { INodeProperties } from 'n8n-workflow';

/**
 * Dossier ID is a resourceLocator: GET /dossiers works (it has no reference
 * page, but it is verified to return every dossier), so From List can be
 * populated. The API ignores search/name/state parameters, so the listSearch
 * method filters client-side — see methods/searchDossiers.ts.
 */
export const dossierIdField: INodeProperties = {
	displayName: 'Dossier',
	name: 'dossierId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'Dossier to act on',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchDossiers', searchable: true },
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 22470767-904e-4553-9586-d7ed4f2b330e',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
						errorMessage: 'Enter a dossier ID in UUID form, e.g. 22470767-904e-4553-9586-d7ed4f2b330e',
					},
				},
			],
		},
	],
};

export const returnAllField: INodeProperties = {
	displayName: 'Return All',
	name: 'returnAll',
	type: 'boolean',
	default: false,
	description: 'Whether to return all results or only up to a given limit',
};

export const limitField: INodeProperties = {
	displayName: 'Limit',
	name: 'limit',
	type: 'number',
	typeOptions: { minValue: 1 },
	default: 50,
	description: 'Max number of results to return',
	displayOptions: { show: { returnAll: [false] } },
};

export const simplifyField: INodeProperties = {
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: false,
	description:
		'Whether to return a simplified version of the response instead of the raw data',
};
