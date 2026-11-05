import type { INodeProperties } from 'n8n-workflow';
import { dossierIdField } from '../../shared/descriptions';
import { inviteeReplaceDescription } from './replace';

const showOnlyForInvitees = { resource: ['invitee'] };

export const inviteeDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForInvitees },
		options: [
			{
				name: 'Replace',
				value: 'replace',
				action: 'Replace an invitee',
				description: 'Overwrite an invitee with a full new definition',
				routing: {
					request: {
						method: 'PUT',
						url: '=/dossiers/{{$parameter.dossierId}}/invitees/{{ encodeURIComponent($parameter.inviteeId) }}',
						body: '={{ JSON.parse($parameter.inviteeJson) }}',
					},
				},
			},
		],
		default: 'replace',
	},
	{
		...dossierIdField,
		description: 'ID of the dossier the invitee belongs to',
		displayOptions: { show: showOnlyForInvitees },
	},
	{
		displayName: 'Invitee ID',
		name: 'inviteeId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
		description: 'ID of the invitee to replace',
		displayOptions: { show: showOnlyForInvitees },
	},
	...inviteeReplaceDescription,
];
