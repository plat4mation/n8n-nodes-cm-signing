import { NodeOperationError } from 'n8n-workflow';
import type {
	IBinaryData,
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';

/** CM.com rejects uploads over 10 MB; fail before spending the round trip. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Delete operations emit a confirmation so the next node has something to act on. */
export async function returnDeleted(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const itemIndex = this.getItemIndex();
	return items.map(() => ({ json: { deleted: true }, pairedItem: { item: itemIndex } }));
}

/**
 * Build the multipart body for POST /upload from an input binary field.
 * Uses the global FormData/Blob — the `form-data` package is outside the
 * cloud import allowlist and inline eslint-disable does not help, because the
 * verification scanner runs ESLint with allowInlineConfig: false.
 */
export async function buildUploadFormData(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const itemIndex = this.getItemIndex();
	const fieldName = this.getNodeParameter('inputDataFieldName') as string;
	const item = this.getInputData();

	if (!item.binary?.[fieldName]) {
		throw new NodeOperationError(
			this.getNode(),
			`The item has no binary field named "${fieldName}". Set "Input Data Field Name" to the field holding the PDF — check the name shown on the incoming item's binary tab. [Item ${itemIndex}]`,
			{ itemIndex },
		);
	}

	const binaryData = item.binary[fieldName] as IBinaryData;
	const buffer = await this.helpers.getBinaryDataBuffer(fieldName);

	if (buffer.length > MAX_UPLOAD_BYTES) {
		const mb = (buffer.length / 1024 / 1024).toFixed(1);
		throw new NodeOperationError(
			this.getNode(),
			`The file in "Input Data Field Name" is ${mb} MB, above the 10 MB that CM.com Sign accepts. Reduce or split the PDF before uploading. [Item ${itemIndex}]`,
			{ itemIndex },
		);
	}

	const formData = new FormData();
	formData.append(
		'file',
		new Blob([buffer], { type: binaryData.mimeType ?? 'application/pdf' }),
		binaryData.fileName ?? 'document.pdf',
	);

	requestOptions.body = formData;
	return requestOptions;
}

/** Convert a downloaded ZIP/PDF response into an n8n binary item. */
export async function handleDossierDownload(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const itemIndex = this.getItemIndex();
	const outputField = this.getNodeParameter('outputDataFieldName') as string;
	const downloadType = this.getNodeParameter('type') as string;
	const mimeType = (response.headers['content-type'] as string | undefined) ?? undefined;
	const extension = mimeType?.includes('zip') ? 'zip' : 'pdf';
	const fileName = `${downloadType === 'auditReport' ? 'audit-report' : 'dossier'}.${extension}`;

	const result: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		const data =
			response.body instanceof Buffer ? response.body : Buffer.from(response.body as ArrayBuffer);

		const newItem: INodeExecutionData = {
			json: {},
			binary: { ...(items[i].binary ?? {}) },
			pairedItem: { item: itemIndex },
		};
		newItem.binary![outputField] = await this.helpers.prepareBinaryData(data, fileName, mimeType);
		result.push(newItem);
	}
	return result;
}

/**
 * Curated <=10-field views of the two large response shapes. Nested values are
 * flattened to counts or joined strings so a simplified item stays scalar.
 */
function simplifyDossier(raw: IDataObject): IDataObject {
	const invitees = Array.isArray(raw.invitees) ? raw.invitees : [];
	const files = Array.isArray(raw.files) ? raw.files : [];
	return {
		id: raw.id,
		name: raw.name,
		state: raw.state,
		completed: raw.completed,
		createdAt: raw.createdAt,
		expiresAt: raw.expiresAt,
		fileCount: files.length,
		inviteeCount: invitees.length,
		inviteeNames: invitees
			.map((i) => (i as IDataObject).name)
			.filter((n): n is string => typeof n === 'string')
			.join(', '),
		prepareUrl: raw.prepareUrl,
	};
}

function simplifyInvite(raw: IDataObject): IDataObject {
	const invitee = (raw.invitee ?? {}) as IDataObject;
	return {
		id: raw.id,
		state: raw.state,
		channel: raw.channel,
		url: raw.url,
		createdAt: raw.createdAt,
		expiresAt: raw.expiresAt,
		inviteeId: invitee.id,
		inviteeName: invitee.name,
		inviteeEmail: invitee.email,
	};
}

/**
 * Applied to dossier and invite responses. A no-op unless the Simplify
 * toggle is on, so the raw shape stays the default.
 */
export async function simplifyResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	if (!this.getNodeParameter('simplify', false)) return items;

	const itemIndex = this.getItemIndex();
	const resource = this.getNodeParameter('resource') as string;
	const simplify = resource === 'invite' ? simplifyInvite : simplifyDossier;

	return items.map((item) => ({
		json: simplify(item.json),
		pairedItem: { item: itemIndex },
	}));
}

/** One field as the CM.com API expects it. */
interface CmSignFieldBody {
	type: string;
	file: string;
	required: boolean;
	tag?: string;
	locations?: Array<{ range?: string; x: number; y: number; width: number; height: number }>;
}

/**
 * Assemble `invitees` for POST /dossiers from the guided Invitees collection.
 *
 * Done in TypeScript rather than a routing expression because the shape nests
 * two levels (invitee -> fields -> locations) and an expression that deep is
 * neither readable nor checkable. Every other guided field keeps its own
 * `routing.send.property`; this only owns `invitees`.
 *
 * A field with neither a tag nor coordinates is still sent — CM.com accepts it
 * but has nowhere to draw it, so it will not appear for the signer.
 */
export async function buildDossierInvitees(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	if ((this.getNodeParameter('bodyMode') as string) !== 'guided') return requestOptions;

	const raw = this.getNodeParameter('invitees', {}) as {
		invitee?: Array<Record<string, unknown>>;
	};

	const invitees = (raw.invitee ?? []).map((entry) => {
		const nested = (entry.fields ?? {}) as { field?: Array<Record<string, unknown>> };

		const fields: CmSignFieldBody[] = (nested.field ?? []).map((f) => {
			const built: CmSignFieldBody = {
				type: f.type as string,
				file: f.file as string,
				required: f.required !== false,
			};

			const tag = (f.tag as string | undefined)?.trim();
			if (tag) built.tag = tag;

			// Coordinates are opt-in: a width of 0 cannot be drawn, so treat it as unset.
			const width = Number(f.width ?? 0);
			const height = Number(f.height ?? 0);
			if (!tag && width > 0 && height > 0) {
				const page = (f.page as string | undefined)?.trim();
				built.locations = [
					{
						...(page ? { range: page } : {}),
						x: Number(f.x ?? 0),
						y: Number(f.y ?? 0),
						width,
						height,
					},
				];
			}

			return built;
		});

		const out: IDataObject = {};
		for (const key of ['name', 'email', 'phoneNumber', 'position', 'readOnly', 'reference']) {
			const v = entry[key];
			if (v !== undefined && v !== '') out[key] = v as never;
		}
		if (fields.length > 0) out.fields = fields as unknown as IDataObject[];
		return out;
	});

	const body = (requestOptions.body ?? {}) as IDataObject;
	body.invitees = invitees;
	requestOptions.body = body;
	return requestOptions;
}
