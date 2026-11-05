import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { clientKeyId, cmSignApiRequest, statusOf } from './GenericFunctions';

/** Header CM.com echoes back on every delivery, carrying the shared secret. */
const VERIFICATION_HEADER = 'x-n8n-cm-sign-token';

function timingSafeStrEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8');
	const bb = Buffer.from(b, 'utf8');
	if (ab.length !== bb.length) return false;
	return timingSafeEqual(ab, bb);
}

export class CmSignTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CM Sign Trigger',
		name: 'cmSignTrigger',
		icon: { light: 'file:../../icons/cmSign.svg', dark: 'file:../../icons/cmSign.dark.svg' },
		iconColor: 'blue',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when signing events happen in CM.com Sign',
		defaults: { name: 'CM Sign Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'cmSignApi', required: true }],
		webhooks: [
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		],
		properties: [
			{
				displayName: 'Trigger On',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['dossier.state.updated'],
				options: [
					{ name: 'Dossier Invite Created', value: 'dossier.invite.created' },
					{ name: 'Dossier Invite Expired', value: 'dossier.invite.expired' },
					{ name: 'Dossier Invite Undelivered', value: 'dossier.invite.undelivered' },
					{ name: 'Dossier Invite Viewed', value: 'dossier.invite.viewed' },
					{
						name: 'Dossier Invitee Reassign Request State Updated',
						value: 'dossier.invitee.reassignRequest.state.updated',
					},
					{ name: 'Dossier Invitee State Updated', value: 'dossier.invitee.state.updated' },
					{ name: 'Dossier Prepared', value: 'dossier.prepared' },
					{ name: 'Dossier State Updated', value: 'dossier.state.updated' },
				],
			},
			{
				displayName: 'Verify Webhook Secret',
				name: 'verifySecret',
				type: 'boolean',
				default: false,
				description:
					'Whether to reject deliveries that do not carry the secret header registered with CM.com. This is a shared secret rather than a payload signature, so it does not protect against replay or against anyone who learns the secret. Defaults to false; turn it on once you have confirmed the header reaches n8n through your proxy.',
			},
		],
	};

	webhookMethods = {
		default: {
			/**
			 * CM has no single-webhook GET, so confirm by listing. On a transient
			 * failure return true: a wrong `false` makes create() register a
			 * duplicate webhook, which double-fires every workflow.
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.webhookId) return false;

				const kid = await clientKeyId.call(this);
				try {
					const response = await cmSignApiRequest.call(this, 'GET', `/clients/${kid}/webhooks`);
					const list = (Array.isArray(response) ? response : (response.webhooks ?? [])) as Array<{
						id: string;
					}>;
					const exists = list.some((w) => w.id === staticData.webhookId);
					if (!exists) {
						delete staticData.webhookId;
						delete staticData.webhookSecret;
					}
					return exists;
				} catch (thrown) {
					this.logger.warn(
						`CM Sign Trigger: could not confirm webhook ${staticData.webhookId as string}: ${(thrown as Error).message}`,
					);
					return true;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const kid = await clientKeyId.call(this);
				const events = this.getNodeParameter('events') as string[];
				const webhookUrl = this.getNodeWebhookUrl('default');
				const secret = randomBytes(32).toString('hex');

				const response = await cmSignApiRequest.call(this, 'POST', `/clients/${kid}/webhooks`, {
					url: webhookUrl,
					events,
					headers: { [VERIFICATION_HEADER]: secret },
				});

				staticData.webhookId = response.id;
				staticData.webhookSecret = secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return true;

				const kid = await clientKeyId.call(this);
				try {
					await cmSignApiRequest.call(this, 'DELETE', `/clients/${kid}/webhooks/${webhookId}`);
				} catch (thrown) {
					if (statusOf(thrown) !== 404) {
						this.logger.warn(
							`CM Sign Trigger: could not remove webhook ${webhookId}: ${(thrown as Error).message}`,
						);
					}
				}
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();

		if (this.getNodeParameter('verifySecret', false) as boolean) {
			const staticData = this.getWorkflowStaticData('node');
			const expected = staticData.webhookSecret as string | undefined;
			const headers = this.getHeaderData() as IDataObject;
			const provided = headers[VERIFICATION_HEADER] as string | undefined;

			// Fail closed: reject unless the secret positively matches.
			if (!expected || !provided || !timingSafeStrEqual(provided, expected)) {
				const res = this.getResponseObject() as {
					writeHead: (statusCode: number) => void;
					end: () => void;
				};
				res.writeHead(401);
				res.end();
				return { noWebhookResponse: true };
			}
		}

		return { workflowData: [this.helpers.returnJsonArray(body as IDataObject)] };
	}
}
