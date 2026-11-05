import type { INodeProperties } from 'n8n-workflow';

const showOnlyForDocumentUpload = { resource: ['document'], operation: ['upload'] };

export const documentUploadDescription: INodeProperties[] = [
	{
		displayName: 'Input Data Field Name',
		name: 'inputDataFieldName',
		type: 'string',
		default: 'data',
		required: true,
		placeholder: 'e.g. data',
		description:
			'Name of the binary field on the incoming item that holds the PDF to upload. CM.com Sign accepts PDFs up to 10 MB.',
		displayOptions: { show: showOnlyForDocumentUpload },
	},
];
