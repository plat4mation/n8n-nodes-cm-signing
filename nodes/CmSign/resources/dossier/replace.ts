import type { INodeProperties } from 'n8n-workflow';

const showOnlyForDossierReplace = { resource: ['dossier'], operation: ['replace'] };

export const dossierReplaceDescription: INodeProperties[] = [
	{
		displayName: 'Dossier',
		name: 'dossierReplaceJson',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Full dossier object to store in place of the current one. PUT replaces the whole dossier, so include every field you want to keep — fields you omit are dropped. Fetch the dossier first and edit the result if you only mean to change part of it.',
		displayOptions: { show: showOnlyForDossierReplace },
	},
];
