import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { searchDossiers } from './methods/searchDossiers';
import { documentDescription } from './resources/document';
import { dossierDescription } from './resources/dossier';
import { inviteDescription } from './resources/invite';
import { inviteeDescription } from './resources/invitee';

export class CmSign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CM Sign',
		name: 'cmSign',
		icon: { light: 'file:../../icons/cmSign.svg', dark: 'file:../../icons/cmSign.dark.svg' },
		iconColor: 'blue',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Upload documents, create signing dossiers and send invites with CM.com Sign',
		defaults: { name: 'CM Sign' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'cmSignApi', required: true }],
		requestDefaults: {
			baseURL:
				'={{$credentials.environment === "sandbox" ? "https://api.cm.com/sign-sandbox/v1" : "https://api.cm.com/sign/v1"}}',
			headers: {
				Accept: 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Document', value: 'document' },
					{ name: 'Dossier', value: 'dossier' },
					{ name: 'Invite', value: 'invite' },
					{ name: 'Invitee', value: 'invitee' },
				],
				default: 'dossier',
			},
			...documentDescription,
			...dossierDescription,
			...inviteDescription,
			...inviteeDescription,
		],
	};

	// Required because the Dossier locator's list mode uses searchListMethod.
	methods = {
		listSearch: {
			searchDossiers,
		},
	};
}
