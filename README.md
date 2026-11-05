# @plat4mation/n8n-nodes-cm-signing

This is an n8n community node package for the [CM.com Sign](https://developers.cm.com/sign/docs/introduction) digital signing API. It lets you upload PDFs, create signing dossiers, invite people to sign, download signed results, and react to signing events in your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

The package ships three nodes and one credential:

- **CM Sign** — a declarative action node with 11 operations across Document, Dossier, Invite and Invitee.
- **CM Sign Trigger** — a programmatic webhook trigger that registers itself with CM.com on activation and fires on signing events.
- **CM Sign Wait** — a dossier-aware wait node that pauses a workflow until signing finishes (or times out).
- **CM Sign API** — the credential, which mints a short-lived JWT per request.

[Installation](#installation)
[Credentials](#credentials)
[Example workflow](#example-workflow)
[Operations](#operations)
[The Dossier field](#the-dossier-field)
[Signature fields](#signature-fields)
[CM Sign Wait](#cm-sign-wait)
[Simplify](#simplify)
[Webhook security](#webhook-security)
[Testing the trigger locally](#testing-the-trigger-locally)
[Scripts](#scripts)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation, and install `@plat4mation/n8n-nodes-cm-signing`.

## Credentials

Create a **CM Sign API** credential with three fields:

- **Environment** — `Sandbox` or `Production`. **Defaults to Sandbox.** CM.com issues a separate Key ID and secret per environment, and a key minted for one environment is rejected by the other with `invalid kid` — it is not a permission error, it is a wrong-environment error. The credential defaults to sandbox deliberately: defaulting to production risks sending real signing invitations from a half-configured credential. Switch to Production consciously, once you've confirmed the Key ID and secret you're using were issued for it.
- **Key ID** — from your CM.com Sign API registration.
- **Secret** — from the same registration. Used locally to sign each request; never sent to CM.com.

There is no OAuth flow and no token endpoint. The credential signs a fresh HS256 JWT for every request, carrying the Key ID as the token's `kid` and a short `iat`/`nbf`/`exp` window — this is how CM.com's Sign API authenticates (it issues long-lived credentials, not tokens).

## Example workflow

A typical end-to-end flow:

1. **CM Sign → Document → Upload** — upload a PDF from a binary field. Returns a file ID.
2. **CM Sign → Dossier → Create** — create a dossier referencing that file ID, with one or more invitees, each with at least one signature field (see [Signature fields](#signature-fields) — a dossier with none stays in `draft` forever).
3. **CM Sign → Invite → Create** — invite one of the dossier's invitees to sign, by email, SMS, WhatsApp, or manually (see below).
4. The invitee signs in CM.com's hosted UI. A **CM Sign Trigger** workflow, listening for `dossier.state.updated`, fires when the dossier completes.
5. **CM Sign → Dossier → Download** — download the signed ZIP (documents + audit report) or just the audit report.

## Operations

| Resource | Operation | Notes |
|---|---|---|
| Document | Upload | Multipart upload of a PDF (≤10 MB) from an input binary field |
| Dossier | Create | Guided form fields (including per-invitee signature fields), or a raw-JSON escape hatch for the full nested schema |
| Dossier | Get | Retrieve a single dossier |
| Dossier | Replace | **Full replacement** (`PUT`) — fields you omit are dropped |
| Dossier | Delete | Returns `{ deleted: true }` |
| Dossier | Download | ZIP archive, a single signed file, or just the audit report |
| Invite | Create | Invite an invitee to sign or review; Channel can be Email, SMS, WhatsApp, or Manual |
| Invite | Get | Retrieve a single invite |
| Invite | Get Many | List a dossier's invites (client-side `Limit`, see below) |
| Invite | Delete | Withdraw an invite; returns `{ deleted: true }` |
| Invitee | Replace | **Full replacement** (`PUT`) — fields you omit are dropped |

Two API facts worth knowing before you build a workflow around these:

- **`GET /dossiers/{id}/invites` does not paginate.** CM.com returns a bare array with no `page`/`limit`/`offset` parameters. Invite → Get Many's `Limit` is therefore applied **client-side**, after the full list comes back — it trims the result, it doesn't reduce what CM.com sends.
- **Invite → Create's Channel field has a `Manual (Do Not Send)` option.** Choosing it omits `channel` from the request entirely, which tells CM.com not to auto-send the invite. Use this when you want to distribute the `inviteUri` from the response yourself (e.g. via your own email template, a chat message, or an embedded link) rather than letting CM.com deliver it.

## The Dossier field

Every operation that acts on an existing dossier (Get, Replace, Delete, Download, and all of Invite/Invitee) uses a resource-locator **Dossier** field with two modes:

- **From List** — searchable, backed by `GET /dossiers`. CM.com's `/dossiers` endpoint returns every dossier and ignores server-side search/name/state filters, so the list is filtered client-side as you type.
- **By ID** — paste a dossier UUID directly.

## Signature fields

**A dossier with no signature fields has nothing to sign.** It stays in `draft` forever and no invite is ever created — confirmed against a live tenant: every dossier with zero invitee fields sat in `draft` with 0 invites, while every `pending`/`completed` one had at least one field. CM.com's API schema marks `invitees[].fields[]` as optional — only one file and one invitee are mandatory — so it is easy to build a dossier that looks complete and is not. Add at least one signature field per signing invitee.

In Dossier → Create's Guided mode, each invitee has:

- **Reference** — your own external identifier for the invitee, up to 255 characters. Stored on the dossier and returned when you read it back.
- **Signature Fields** — one entry per field, with:
  - **Type** — `signature`, `signatureDate`, `initials`, `text`, `textarea`, `label`, `checkbox`, `radio`, or `stamp`.
  - **File ID** — which uploaded file the field belongs to.
  - **Required** — whether the invitee must complete it (defaults to true).
  - Placement — either **Tag**, or coordinates (**Page**, **X**, **Y**, **Width**, **Height**). Never both.

Placement is **either a tag or coordinates, never both.** Set a Tag and the assembler sends `tag`; leave Tag empty and give both Width and Height a value greater than zero and it sends `locations: [{ range, x, y, width, height }]` instead (`range` carries the Page value, when set — Page itself is optional). **Tags are the better choice for automation**: put a placeholder like `{signature1}` in the PDF and CM.com finds it there, so no coordinates need to be computed. Coordinates are points at 72 DPI, with the origin at the top-left of the page.

A field with **neither** a tag nor coordinates is still accepted by CM.com — it just has nowhere to be drawn, so the signer never sees it.

Guided mode sends one location per field. Fields needing multiple locations (the same field repeated across pages) are only expressible in Raw JSON mode.

## CM Sign Wait

Pauses a workflow until a CM.com Sign dossier reaches a target state, polling on an interval, then continues.

**Before anything else: wire the node's `loop` output back into its own input.** The node has two outputs, `done` and `loop`. n8n cannot resume an execution back inside the same node — `putExecutionToWait` resumes at the *next* node in the graph, and `execute()` is not re-entered — so each pass checks the dossier once, decides it isn't ready, and sleeps via `loop`. Connect `loop` to the node's own input to get repeated polling. **Skip that connection and the workflow silently ends after the first sleep**, with no further checks and no error.

**`Max Wait (Seconds)` is measured from the dossier's creation time, not from when the node first ran.** There is nowhere safe to persist per-execution state between sleeps, so the deadline is computed from CM data on every pass: `dossier.createdAt + maxWait` seconds, or — when Max Wait is `0` — the dossier's own `expiresAt`. This means the countdown does not restart each time you re-run or re-trigger the workflow against the same dossier; it is anchored to when the dossier was created in CM.com.

Parameters:

| Field | Notes |
|---|---|
| Dossier | Resource-locator (From List or By ID) — the dossier to wait for |
| Resume When | `Dossier Is Completed` (state is `completed`); `Dossier Reaches a Chosen State` (one specific state, set via **State**); `Dossier Stops Changing` (any of `completed`, `declined`, `expired`, `deleted` — states the dossier cannot leave). Defaults to `Dossier Stops Changing`. |
| State | Only shown when Resume When is "Dossier Reaches a Chosen State": `completed`, `declined`, `deleted`, `expired`, or `pending` |
| Poll Interval (Seconds) | How long to sleep between checks. Minimum 15. Defaults to 60. |
| Max Wait (Seconds) | How long to keep waiting, from the dossier's creation time. `0` waits until the dossier's own expiry. Defaults to 0. |
| On Timeout | `Continue With Current State` (send the dossier down `done` regardless of state) or `Stop the Workflow`. Defaults to `Continue With Current State`. |

On each pass the node fetches the dossier once via `GET /dossiers/{id}`. If it has reached the target state (or the wait has timed out), the item goes to `done`; otherwise it goes to `loop` and the execution suspends until the next poll.

**Built-in alternative:** n8n's own **Wait** node, followed by **CM Sign → Dossier → Get** and an **If** node, achieves the same result with no custom node — loop the If's false branch back to the Wait node. `CM Sign Wait` just bundles that dossier-aware check into a single step.

## Simplify

Dossier → Create, Dossier → Get, Invite → Get, and Invite → Get Many each have a **Simplify** toggle (default off). CM.com's dossier and invite responses carry more than 10 fields with nested arrays; turning Simplify on returns a curated subset (ID, name/state, counts instead of full nested arrays, and similar) instead of the raw response.

## Webhook security

**CM.com does not sign webhook payloads.** There is no HMAC or signature header covering the request body — this is a real gap in CM.com's webhook design, not a limitation of this node.

What this node does instead: on activation, **CM Sign Trigger** registers a webhook with CM.com carrying a randomly generated secret in a custom HTTP header (CM.com's webhook registration API accepts arbitrary custom headers, which it echoes back unmodified on every delivery). The **Verify Webhook Secret** toggle, when enabled, compares the incoming header against the stored secret with a constant-time comparison and responds `401` if it is missing or doesn't match.

Be clear about what this buys you and what it doesn't:

- It proves the request carries a header value this node registered — a basic bar against a webhook URL being called by something that never saw the registration.
- It is **not a signature**. It does not bind the secret to the payload: nothing cryptographically ties the header to the body, so a header value and body can be freely recombined by anyone who has seen a secret once.
- It gives **no replay protection**. A captured request (header, body, and all) can be resent and will pass verification every time.
- It does **not survive disclosure of the secret**. Anyone who obtains the header value (a misconfigured log, a proxy, a leaked screenshot) can forge arbitrary payloads indefinitely; there is no rotation built in.

**Verify Webhook Secret defaults to off.** This is deliberate: on first activation you don't yet know whether your reverse proxy, load balancer, or CM.com's delivery path strips or rewrites custom headers. If verification defaulted to on, a first-time user could see every delivery silently rejected with no indication why. Turn it on only after confirming (e.g. via the Trigger node's execution data) that the header arrives at n8n intact.

## Testing the trigger locally

`npm run dev:tunnel` runs n8n locally behind a public Cloudflare quick tunnel (`scripts/dev-tunnel.sh`), so CM.com can reach your webhook URL during development. Requires [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`brew install cloudflared`). Without a public URL, CM.com's webhook registration succeeds but no delivery ever arrives.

The script builds the package, links it into `~/.n8n-node-cli/.n8n/custom`, keeps `dist/` fresh with `tsc --watch`, and runs n8n from `.n8n-dev/` (installed on first run) with `WEBHOOK_URL` set to the tunnel. n8n is bound to `127.0.0.1`, because cloudflared can't reach n8n's default IPv6 `::` listener (502 Bad Gateway). The quick-tunnel URL changes on every run, so deactivate and reactivate the trigger after a restart to re-register the webhook.

```bash
npm run dev:tunnel                                  # public tunnel (default)
npm run dev:tunnel -- --no-tunnel                   # localhost only
WEBHOOK_URL=https://your.tunnel npm run dev:tunnel  # bring your own tunnel
N8N_PORT=5679 npm run dev:tunnel                    # when 5678 is already in use
```

## Scripts

`scripts/list-webhooks.mjs` is a read-only helper that lists the webhooks registered for the Key ID in your local `.env` (`KEYID`/`SECRET`). It targets **sandbox** by default; set `CM_SIGN_BASE` to point it at production (e.g. `CM_SIGN_BASE=https://api.cm.com/sign/v1 node scripts/list-webhooks.mjs`).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [CM.com Sign API documentation](https://developers.cm.com/sign/docs/introduction)
- [CM.com Sign API reference](https://developers.cm.com/sign/reference)

## License

[MIT](LICENSE). Created by Luc Raeskin for [Plat4mation](https://www.plat4mation.com).
