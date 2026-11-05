import type { INodeProperties } from 'n8n-workflow';

const showOnlyForDossierDownload = { resource: ['dossier'], operation: ['download'] };

export const dossierDownloadDescription: INodeProperties[] = [
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'zip',
		description: 'Which part of the completed dossier to download',
		displayOptions: { show: showOnlyForDossierDownload },
		options: [
			{
				name: 'Audit Report',
				value: 'auditReport',
				description: 'Only the audit report, as a PDF',
			},
			{
				name: 'Signed File',
				value: 'file',
				description: 'A single signed document, as a PDF',
			},
			{
				name: 'ZIP Archive',
				value: 'zip',
				description: 'Every signed document plus the audit report, as a ZIP',
			},
		],
		routing: { send: { type: 'query', property: 'type' } },
	},
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 3f2b1c8a-5d4e-4a7b-9c1d-2e3f4a5b6c7d',
		description:
			'Which document to download when the dossier holds more than one. Leave empty for a single-document dossier, where CM.com picks the only file.',
		displayOptions: { show: { ...showOnlyForDossierDownload, type: ['file'] } },
		routing: { send: { type: 'query', property: 'file' } },
	},
	{
		displayName: 'Output Data Field Name',
		name: 'outputDataFieldName',
		type: 'string',
		default: 'data',
		required: true,
		placeholder: 'e.g. data',
		description: 'Name of the binary field to write the downloaded file to',
		displayOptions: { show: showOnlyForDossierDownload },
	},
];
