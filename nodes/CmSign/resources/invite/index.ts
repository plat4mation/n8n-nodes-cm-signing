import type { INodeProperties } from 'n8n-workflow';
import { dossierIdField } from '../../shared/descriptions';
import { returnDeleted, simplifyResponse } from '../../shared/transforms';
import { inviteCreateDescription } from './create';
import { inviteGetDescription } from './get';
import { inviteGetManyDescription } from './getAll';

const showOnlyForInvites = { resource: ['invite'] };

/** Operations addressing one existing invite, so needing the Invite ID. */
const singleInviteOperations = ['get', 'delete'];

export const inviteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForInvites },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an invite',
				description: 'Invite an invitee to sign or review a dossier',
				routing: {
					request: {
						method: 'POST',
						url: '=/dossiers/{{$parameter.dossierId}}/invites',
						// POST /dossiers/{id}/invites takes a top-level ARRAY of invite
						// objects (verified against the reference page), so the body is
						// built here as a one-element array rather than through
						// per-field routing.send — see the note in ./create.ts.
						body: '={{ [{ inviteeId: $parameter.inviteeId, ...($parameter.channel ? { channel: $parameter.channel } : {}), ...($parameter.additionalFields?.emailMessage ? { emailConfig: { message: $parameter.additionalFields.emailMessage } } : {}), ...($parameter.additionalFields?.reminder !== undefined ? { reminder: $parameter.additionalFields.reminder } : {}), ...($parameter.additionalFields?.expiresIn ? { expiresIn: $parameter.additionalFields.expiresIn } : {}) }] }}',
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an invite',
				description: 'Withdraw an invite that has not been completed',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/dossiers/{{$parameter.dossierId}}/invites/{{ encodeURIComponent($parameter.inviteId) }}',
					},
					output: { postReceive: [returnDeleted] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an invite',
				description: 'Retrieve a single invite and its delivery state',
				routing: {
					request: {
						method: 'GET',
						url: '=/dossiers/{{$parameter.dossierId}}/invites/{{ encodeURIComponent($parameter.inviteId) }}',
					},
					output: { postReceive: [simplifyResponse] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many invites',
				description: 'Retrieve the invites of a dossier',
				routing: {
					request: {
						method: 'GET',
						url: '=/dossiers/{{$parameter.dossierId}}/invites',
					},
					// The endpoint takes no pagination parameters and returns a bare
					// array, so Limit has to be applied after the response.
					output: {
						postReceive: [
							{
								type: 'limit',
								properties: {
									maxResults: '={{ $parameter.returnAll ? 999999 : $parameter.limit }}',
								},
							},
							simplifyResponse,
						],
					},
				},
			},
		],
		default: 'getAll',
	},
	{
		...dossierIdField,
		description: 'ID of the dossier the invite belongs to',
		displayOptions: { show: showOnlyForInvites },
	},
	{
		displayName: 'Invite ID',
		name: 'inviteId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
		description: 'ID of the invite to act on',
		displayOptions: { show: { ...showOnlyForInvites, operation: singleInviteOperations } },
	},
	...inviteCreateDescription,
	...inviteGetDescription,
	...inviteGetManyDescription,
];
