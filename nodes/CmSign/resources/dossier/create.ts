import type { INodeProperties } from 'n8n-workflow';
import { simplifyField } from '../../shared/descriptions';

const showOnlyForDossierCreate = { resource: ['dossier'], operation: ['create'] };
const showForGuided = { ...showOnlyForDossierCreate, bodyMode: ['guided'] };

export const dossierCreateDescription: INodeProperties[] = [
	{
		displayName: 'Body Mode',
		name: 'bodyMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Guided',
				value: 'guided',
				description: 'Fill in files, invitees and owners as form fields',
			},
			{
				name: 'Raw JSON',
				value: 'raw',
				description:
					'Supply the whole dossier object, for field coordinates and other advanced options',
			},
		],
		default: 'guided',
		displayOptions: { show: showOnlyForDossierCreate },
	},

	// ---- Raw mode ----
	{
		displayName: 'Dossier',
		name: 'dossierJson',
		type: 'json',
		default: '{\n  "name": "",\n  "files": [],\n  "invitees": []\n}',
		required: true,
		description:
			'Full dossier object as accepted by POST /dossiers, including per-invitee fields and their coordinate locations. See the CM.com Sign API reference for the schema.',
		displayOptions: { show: { ...showOnlyForDossierCreate, bodyMode: ['raw'] } },
	},

	// ---- Guided mode ----
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Employment contract - J. Doe',
		description: 'Human-readable name for the dossier, up to 255 characters',
		displayOptions: { show: showForGuided },
		routing: { send: { type: 'body', property: 'name' } },
	},
	{
		displayName: 'File IDs',
		name: 'fileIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 3f2b1c8a-5d4e-4a7b-9c1d-2e3f4a5b6c7d',
		description:
			'Comma-separated IDs of previously uploaded files, in signing order. Use the Document Upload operation to get an ID.',
		displayOptions: { show: showForGuided },
		routing: {
			send: {
				type: 'body',
				property: 'files',
				value:
					'={{ $value.split(",").map((id) => id.trim()).filter((id) => id !== "").map((id) => ({ id })) }}',
			},
		},
	},
	{
		displayName: 'Invitees',
		name: 'invitees',
		placeholder: 'Add Invitee',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'People who sign or review the documents',
		displayOptions: { show: showForGuided },
		options: [
			{
				displayName: 'Invitee',
				name: 'invitee',
				values: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'e.g. jane.doe@example.com',
						default: '',
						description: 'Email address the invite is sent to',
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. Jane Doe',
						description: 'Full name of the invitee',
					},
					{
						displayName: 'Phone Number',
						name: 'phoneNumber',
						type: 'string',
						default: '',
						placeholder: 'e.g. +31612345678',
						description: 'Phone number in E.164 format, for SMS or WhatsApp invites',
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'number',
						default: 1,
						typeOptions: { minValue: 1 },
						description:
							'Signing order. Invitees with a lower position are invited first. Defaults to 1.',
					},
					{
						displayName: 'Reference',
						name: 'reference',
						type: 'string',
						default: '',
						placeholder: 'e.g. crm-contact-4471',
						description:
							'Your own identifier for this invitee, up to 255 characters. Stored on the dossier and returned when you read it back.',
					},
					{
						displayName: 'Review Only',
						name: 'readOnly',
						type: 'boolean',
						default: false,
						description:
							'Whether the invitee only reviews the documents instead of signing them. Defaults to false.',
					},
					{
						displayName: 'Signature Fields',
						name: 'fields',
						placeholder: 'Add Signature Field',
						type: 'fixedCollection',
						typeOptions: { multipleValues: true },
						default: {},
						description:
							'Where this invitee signs or fills in data. A dossier with no fields has nothing to sign and stays in draft, so add at least one signature field per signing invitee.',
						options: [
							{
								displayName: 'Field',
								name: 'field',
								values: [
									{
										displayName: 'File ID',
										name: 'file',
										type: 'string',
										default: '',
										required: true,
										placeholder: 'e.g. 3f2b1c8a-5d4e-4a7b-9c1d-2e3f4a5b6c7d',
										description:
											'ID of the uploaded file this field belongs to, as returned by the Document Upload operation',
									},
									{
										displayName: 'Height',
										name: 'height',
										type: 'number',
										default: 0,
										description: 'Field height in points at 72 DPI',
									},
									{
										displayName: 'Page',
										name: 'page',
										type: 'string',
										default: '',
										placeholder: 'e.g. 1',
										description:
											'Page the field sits on, for coordinate placement. Ignored when a tag is set.',
									},
									{
										displayName: 'Required',
										name: 'required',
										type: 'boolean',
										default: true,
										description: 'Whether the invitee must complete this field. Defaults to true.',
									},
									{
										displayName: 'Tag',
										name: 'tag',
										type: 'string',
										default: '',
										placeholder: 'e.g. {signature1}',
										description:
											'Placeholder text present in the document. CM.com positions the field wherever the tag appears, so no coordinates are needed. Leave empty to position by coordinates instead. With neither a tag nor coordinates, CM.com accepts the field but has nowhere to draw it, so the signer will never see it.',
									},
									{
										displayName: 'Type',
										name: 'type',
										type: 'options',
										default: 'signature',
										description: 'What the invitee fills in at this spot',
										options: [
											{ name: 'Checkbox', value: 'checkbox' },
											{ name: 'Initials', value: 'initials' },
											{ name: 'Label', value: 'label' },
											{ name: 'Radio', value: 'radio' },
											{ name: 'Signature', value: 'signature' },
											{ name: 'Signature Date', value: 'signatureDate' },
											{ name: 'Stamp', value: 'stamp' },
											{ name: 'Text', value: 'text' },
											{ name: 'Textarea', value: 'textarea' },
										],
									},
									{
										displayName: 'Width',
										name: 'width',
										type: 'number',
										default: 0,
										description: 'Field width in points at 72 DPI',
									},
									{
										displayName: 'X',
										name: 'x',
										type: 'number',
										default: 0,
										description:
											'Horizontal position in points at 72 DPI, measured from the left edge. Set X, Y, Width and Height together to place by coordinates.',
									},
									{
										displayName: 'Y',
										name: 'y',
										type: 'number',
										default: 0,
										description:
											'Vertical position in points at 72 DPI, measured from the top edge',
									},
								],
							},
						],
					},
				],
			},
		],
	},
	{
		displayName: 'Owners',
		name: 'owners',
		placeholder: 'Add Owner',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		description: 'Contacts who receive status updates about the dossier',
		displayOptions: { show: showForGuided },
		options: [
			{
				displayName: 'Owner',
				name: 'owner',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. Sam Owner',
						description: 'Full name of the owner',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. sam.owner@example.com',
						description: 'Email address that receives status updates',
					},
					{
						displayName: 'CC',
						name: 'cc',
						type: 'boolean',
						default: false,
						description: 'Whether to copy this owner on invitee correspondence. Defaults to false.',
					},
				],
			},
		],
		routing: {
			send: { type: 'body', property: 'owners', value: '={{ $value.owner ?? [] }}' },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showForGuided },
		options: [
			{
				displayName: 'Archive',
				name: 'archive',
				type: 'boolean',
				default: false,
				description: 'Whether to archive the dossier once it completes. Defaults to false.',
				routing: { send: { type: 'body', property: 'archive' } },
			},
			{
				displayName: 'Expires In (Seconds)',
				name: 'expiresIn',
				type: 'number',
				typeOptions: { minValue: 60, maxValue: 7776000 },
				default: 2592000,
				description:
					'How long the dossier stays open, in seconds, between 60 and 7776000. Defaults to 2592000 (30 days).',
				routing: { send: { type: 'body', property: 'expiresIn' } },
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: 'en-US',
				placeholder: 'e.g. nl-NL',
				description: 'Language of the signing interface and emails. Defaults to en-US.',
				routing: { send: { type: 'body', property: 'locale' } },
			},
			{
				displayName: 'Prepare',
				name: 'prepare',
				type: 'boolean',
				default: false,
				description:
					'Whether to place signature fields in a CM.com hosted interface instead of by coordinates. Returns a prepareUrl valid for 60 minutes. Defaults to false.',
				routing: { send: { type: 'body', property: 'prepare' } },
			},
			{
				displayName: 'Prepare Return URL',
				name: 'prepareReturnUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/done',
				description: 'HTTPS address to return to after field placement finishes',
				routing: { send: { type: 'body', property: 'prepareReturnUrl' } },
			},
			{
				displayName: 'Reminder In (Seconds)',
				name: 'reminderIn',
				type: 'number',
				typeOptions: { minValue: 60 },
				default: 86400,
				description:
					'How long to wait before sending an automatic reminder, in seconds. Defaults to 86400 (24 hours).',
				routing: { send: { type: 'body', property: 'reminderIn' } },
			},
			{
				displayName: 'Template ID',
				name: 'template',
				type: 'string',
				default: '',
				placeholder: 'e.g. 9b2c3d4e-5f60-4a71-8b92-0c1d2e3f4a5b',
				description: 'ID of a template to base the dossier on',
				routing: { send: { type: 'body', property: 'template' } },
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: '',
				placeholder: 'e.g. Europe/Amsterdam',
				description: 'IANA timezone used for timestamps in the audit report',
				routing: { send: { type: 'body', property: 'timezone' } },
			},
		],
	},
	{ ...simplifyField, displayOptions: { show: showOnlyForDossierCreate } },
];
