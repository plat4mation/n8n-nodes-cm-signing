import type { INodeProperties } from 'n8n-workflow';

const showOnlyForInviteCreate = { resource: ['invite'], operation: ['create'] };

/**
 * Field names and the Channel enum below were verified against
 * https://developers.cm.com/sign/reference/create_dossier_invite, which
 * documents the request body as an ARRAY of invite objects with fields
 * inviteeId, channel (email/sms/whatsapp, no "manual"), emailConfig.message
 * and expiresIn/reminder — not the flat { invitee, channel, message, subject }
 * shape from CM's getting-started prose. Because the body is a top-level
 * array, these fields carry no per-field `routing.send` — lodash's path-based
 * `set()` used by declarative routing cannot build an array from field-level
 * property paths (`set({}, '[0].a', 1)` yields `{ "0": { a: 1 } }`, not an
 * array). The whole body is assembled instead by a single expression on the
 * Create operation's routing.request.body in ./index.ts.
 */
export const inviteCreateDescription: INodeProperties[] = [
	{
		displayName: 'Invitee ID',
		name: 'inviteeId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
		description: 'ID of the invitee to invite, as returned when the dossier was created',
		displayOptions: { show: showOnlyForInviteCreate },
	},
	{
		displayName: 'Channel',
		name: 'channel',
		type: 'options',
		default: 'email',
		description:
			'How to deliver the invite. Choose Manual to suppress sending and share the inviteUri from the response yourself.',
		displayOptions: { show: showOnlyForInviteCreate },
		options: [
			{ name: 'Email', value: 'email' },
			{
				name: 'Manual (Do Not Send)',
				value: '',
				description: 'Do not send the invite. Share the inviteUri from the response yourself.',
			},
			{ name: 'SMS', value: 'sms' },
			{ name: 'WhatsApp', value: 'whatsapp' },
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForInviteCreate },
		options: [
			{
				displayName: 'Email Message',
				name: 'emailMessage',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Custom text included in the email invite message',
			},
			{
				displayName: 'Expires In (Seconds)',
				name: 'expiresIn',
				type: 'number',
				typeOptions: { minValue: 60, maxValue: 7776000 },
				default: 2592000,
				description: 'How long the invite stays valid, in seconds, between 60 and 7776000. Defaults to 2592000 (30 days).',
			},
			{
				displayName: 'Reminder',
				name: 'reminder',
				type: 'boolean',
				default: false,
				description: 'Whether this invite is a reminder of an earlier invite. Defaults to false.',
			},
		],
	},
];
