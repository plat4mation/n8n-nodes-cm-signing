import type { INodeProperties } from 'n8n-workflow';

const showOnlyForInviteeReplace = { resource: ['invitee'], operation: ['replace'] };

export const inviteeReplaceDescription: INodeProperties[] = [
	{
		displayName: 'Invitee',
		name: 'inviteeJson',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Full invitee object to store in place of the current one. PUT replaces the whole invitee, so include every field you want to keep — fields you omit are dropped.',
		displayOptions: { show: showOnlyForInviteeReplace },
	},
];
