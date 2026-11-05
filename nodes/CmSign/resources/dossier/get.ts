import type { INodeProperties } from 'n8n-workflow';
import { simplifyField } from '../../shared/descriptions';

const showOnlyForDossierGet = { resource: ['dossier'], operation: ['get'] };

export const dossierGetDescription: INodeProperties[] = [
	{ ...simplifyField, displayOptions: { show: showOnlyForDossierGet } },
];
