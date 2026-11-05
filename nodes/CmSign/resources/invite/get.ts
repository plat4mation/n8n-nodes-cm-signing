import type { INodeProperties } from 'n8n-workflow';
import { simplifyField } from '../../shared/descriptions';

const showOnlyForInviteGet = { resource: ['invite'], operation: ['get'] };

export const inviteGetDescription: INodeProperties[] = [
	{ ...simplifyField, displayOptions: { show: showOnlyForInviteGet } },
];
