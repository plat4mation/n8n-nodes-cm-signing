import type { INodeProperties } from 'n8n-workflow';
import { limitField, returnAllField, simplifyField } from '../../shared/descriptions';

const showOnlyForInviteGetAll = { resource: ['invite'], operation: ['getAll'] };

export const inviteGetManyDescription: INodeProperties[] = [
	{ ...returnAllField, displayOptions: { show: showOnlyForInviteGetAll } },
	{
		...limitField,
		displayOptions: { show: { ...showOnlyForInviteGetAll, returnAll: [false] } },
	},
	{ ...simplifyField, displayOptions: { show: showOnlyForInviteGetAll } },
];
