import type { INodeProperties } from 'n8n-workflow';
import { buildUploadFormData } from '../../shared/transforms';
import { documentUploadDescription } from './upload';

const showOnlyForDocuments = { resource: ['document'] };

export const documentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDocuments },
		options: [
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a document',
				description: 'Upload a PDF so it can be added to a dossier',
				routing: {
					request: { method: 'POST', url: '/upload' },
					send: { preSend: [buildUploadFormData] },
				},
			},
		],
		default: 'upload',
	},
	...documentUploadDescription,
];
