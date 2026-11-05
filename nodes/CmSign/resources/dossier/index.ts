import type { INodeProperties } from 'n8n-workflow';
import { dossierIdField } from '../../shared/descriptions';
import {
	returnDeleted,
	handleDossierDownload,
	simplifyResponse,
	buildDossierInvitees,
} from '../../shared/transforms';
import { dossierCreateDescription } from './create';
import { dossierGetDescription } from './get';
import { dossierReplaceDescription } from './replace';
import { dossierDownloadDescription } from './download';

const showOnlyForDossiers = { resource: ['dossier'] };

/** Operations addressing one existing dossier, so needing the Dossier ID. */
const singleDossierOperations = ['get', 'replace', 'delete', 'download'];

export const dossierDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDossiers },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a dossier',
				description: 'Create a dossier from uploaded files and invitees',
				routing: {
					request: {
						method: 'POST',
						url: '/dossiers',
						body: '={{ $parameter.bodyMode === "raw" ? JSON.parse($parameter.dossierJson) : {} }}',
					},
					send: { preSend: [buildDossierInvitees] },
					output: { postReceive: [simplifyResponse] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a dossier',
				description: 'Delete a dossier and everything in it',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/dossiers/{{$parameter.dossierId}}',
					},
					output: { postReceive: [returnDeleted] },
				},
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download a dossier',
				description: 'Download the signed documents or audit report of a dossier',
				routing: {
					request: {
						method: 'GET',
						url: '=/dossiers/{{$parameter.dossierId}}/download',
						encoding: 'arraybuffer',
						headers: { Accept: '*/*' },
					},
					output: { postReceive: [handleDossierDownload] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a dossier',
				description: 'Retrieve a single dossier with its files, invitees and state',
				routing: {
					request: {
						method: 'GET',
						url: '=/dossiers/{{$parameter.dossierId}}',
					},
					output: { postReceive: [simplifyResponse] },
				},
			},
			{
				name: 'Replace',
				value: 'replace',
				action: 'Replace a dossier',
				description: 'Overwrite a dossier with a full new definition',
				routing: {
					request: {
						method: 'PUT',
						url: '=/dossiers/{{$parameter.dossierId}}',
						body: '={{ JSON.parse($parameter.dossierReplaceJson) }}',
					},
				},
			},
		],
		default: 'get',
	},
	{
		...dossierIdField,
		displayOptions: { show: { ...showOnlyForDossiers, operation: singleDossierOperations } },
	},
	...dossierCreateDescription,
	...dossierGetDescription,
	...dossierReplaceDescription,
	...dossierDownloadDescription,
];
