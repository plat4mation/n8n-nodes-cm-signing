import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { searchDossiers } from '../CmSign/methods/searchDossiers';

const TERMINAL_STATES = ['completed', 'declined', 'expired', 'deleted'];

function baseUrl(environment: string): string {
	return environment === 'sandbox'
		? 'https://api.cm.com/sign-sandbox/v1'
		: 'https://api.cm.com/sign/v1';
}

export class CmSignWait implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CM Sign Wait',
		name: 'cmSignWait',
		icon: { light: 'file:../../icons/cmSign.svg', dark: 'file:../../icons/cmSign.dark.svg' },
		iconColor: 'blue',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resumeWhen"]}}',
		description: 'Pause the workflow until a CM.com Sign dossier finishes signing',
		defaults: { name: 'CM Sign Wait' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main, NodeConnectionTypes.Main],
		outputNames: ['done', 'loop'],
		usableAsTool: true,
		credentials: [{ name: 'cmSignApi', required: true }],
		properties: [
			{
				displayName:
					"Wire the <b>loop</b> output back into this node's input. Each pass checks the dossier once, then sleeps. Without that connection the workflow stops after the first sleep.",
				name: 'loopNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Dossier',
				name: 'dossierId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Dossier to wait for',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: { searchListMethod: 'searchDossiers', searchable: true },
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 22470767-904e-4553-9586-d7ed4f2b330e',
					},
				],
			},
			{
				displayName: 'Resume When',
				name: 'resumeWhen',
				type: 'options',
				default: 'terminal',
				description: 'What the dossier has to reach before the workflow continues',
				options: [
					{
						name: 'Dossier Is Completed',
						value: 'completed',
						description: 'Continue only once every invitee has signed',
					},
					{
						name: 'Dossier Reaches a Chosen State',
						value: 'state',
						description: 'Continue when the dossier reaches one specific state',
					},
					{
						name: 'Dossier Stops Changing',
						value: 'terminal',
						description:
							'Continue on completed, declined, expired or deleted — any state the dossier cannot leave',
					},
				],
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				default: 'completed',
				description: 'The state to wait for',
				displayOptions: { show: { resumeWhen: ['state'] } },
				options: [
					{ name: 'Completed', value: 'completed' },
					{ name: 'Declined', value: 'declined' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Pending', value: 'pending' },
				],
			},
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollInterval',
				type: 'number',
				typeOptions: { minValue: 15 },
				default: 60,
				description: 'How long to sleep between checks. Defaults to 60.',
			},
			{
				displayName: 'Max Wait (Seconds)',
				name: 'maxWait',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description:
					"How long to keep waiting, measured from the dossier's creation time and not from when this node first ran. Set 0 to wait until the dossier's own expiry. Defaults to 0.",
			},
			{
				displayName: 'On Timeout',
				name: 'onTimeout',
				type: 'options',
				default: 'output',
				description: 'What to do when the wait runs out before the dossier is ready',
				options: [
					{
						name: 'Continue With Current State',
						value: 'output',
						description: 'Send the dossier down the done output with whatever state it has',
					},
					{
						name: 'Stop the Workflow',
						value: 'stop',
						description: 'Halt the run instead of continuing',
					},
				],
			},
		],
	};

	// Required because the Dossier locator's list mode uses searchListMethod.
	methods = {
		listSearch: {
			searchDossiers,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const done: INodeExecutionData[] = [];
		const loop: INodeExecutionData[] = [];
		let earliestWake: number | undefined;

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('cmSignApi', i);
				const dossierId = this.getNodeParameter('dossierId', i, '', {
					extractValue: true,
				}) as string;
				const resumeWhen = this.getNodeParameter('resumeWhen', i) as string;
				const pollInterval = this.getNodeParameter('pollInterval', i) as number;
				const maxWait = this.getNodeParameter('maxWait', i) as number;
				const onTimeout = this.getNodeParameter('onTimeout', i) as string;

				const dossier = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'cmSignApi',
					{
						method: 'GET',
						url: `${baseUrl(credentials.environment as string)}/dossiers/${encodeURIComponent(dossierId)}`,
						json: true,
					},
				)) as IDataObject;

				const state = dossier.state as string;
				const ready =
					resumeWhen === 'completed'
						? state === 'completed'
						: resumeWhen === 'state'
							? state === (this.getNodeParameter('state', i) as string)
							: TERMINAL_STATES.includes(state);

				if (ready) {
					done.push({ json: dossier, pairedItem: { item: i } });
					continue;
				}

				// Deadline comes from CM data so it is identical on every pass.
				const createdAt = Date.parse(dossier.createdAt as string);
				const deadline =
					maxWait > 0 ? createdAt + maxWait * 1000 : Date.parse(dossier.expiresAt as string);

				if (Number.isFinite(deadline) && Date.now() >= deadline) {
					if (onTimeout === 'stop') {
						throw new NodeOperationError(
							this.getNode(),
							`The dossier was still "${state}" when the wait ran out. Raise "Max Wait (Seconds)", or set "On Timeout" to continue with the current state. [Item ${i}]`,
							{ itemIndex: i },
						);
					}
					done.push({
						json: { ...dossier, timedOut: true },
						pairedItem: { item: i },
					});
					continue;
				}

				const wake = Date.now() + pollInterval * 1000;
				earliestWake = earliestWake === undefined ? wake : Math.min(earliestWake, wake);
				loop.push({ json: dossier, pairedItem: { item: i } });
			} catch (thrown) {
				if (this.continueOnFail()) {
					done.push({
						json: { message: (thrown as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), thrown as Error, { itemIndex: i });
			}
		}

		// One suspension for the whole batch, at the earliest wake time.
		if (earliestWake !== undefined) {
			await this.putExecutionToWait(new Date(earliestWake));
		}

		return [done, loop];
	}
}
