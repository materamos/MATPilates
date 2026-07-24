# Local Codex–Figma typography bridge

## Decision

MAT uses a project-owned local bridge when Codex must inspect or change
typography that depends on fonts installed in Windows. It supplements the
official Figma connector; it does not replace it.

The bridge is deliberately limited to typography. Layout, components, colors,
variables, prototyping, and general Figma work continue through the official
connector.

## Architecture

```text
Codex Desktop
  │ MCP over STDIO
  ▼
Local Node.js server
  │ authenticated WebSocket via localhost:3847
  ▼
Figma plugin UI
  │ validated postMessage
  ▼
Figma plugin main sandbox
  └─ local fonts, document reads, preview, manual patch approval
```

The server and Figma plugin share protocol version `1`. Figma connects to the
fixed endpoint `ws://localhost:3847/mat-figma-bridge` with subprotocol
`mat-figma-bridge.v1`, while the server binds only to the explicit loopback
addresses `127.0.0.1:3847` and `[::1]:3847`. The `localhost` spelling is
required by Figma's development manifest validation and may resolve to either
loopback address on Windows; it never causes the server to bind a LAN
interface or select another port.

## Responsibilities

The local server:

- exposes eleven narrow MCP tools over STDIO;
- reserves stdout for MCP and writes only sanitized diagnostics to stderr;
- listens only on the explicit IPv4 and IPv6 loopback addresses;
- issues and validates pairing credentials;
- advertises and validates a distinct output schema for every MCP tool;
- validates every plugin response against the schema for its exact method;
- serializes plugin RPC in FIFO order;
- forwards exact operations without executing arbitrary JavaScript.

The Figma plugin UI:

- owns the WebSocket connection because the main plugin sandbox has no browser
  networking API;
- stores the issued token in `figma.clientStorage`;
- explains what content can be sent to Codex;
- displays the generated patch summary in Spanish;
- lists every exact operation, target ID, range, typography value, and bounded
  whitespace-normalized replacement-text preview, with an explicit truncation
  marker when needed, in that approval;
- lists every affected layer with page, name, node type, and ID, up to the
  500-node protocol limit;
- displays the required post-apply preview target before approval;
- reports apply-time warnings and exposes the ephemeral `Deshacer lote` action
  only while it remains safe;
- requires an explicit `Aplicar` or `Rechazar` decision for every batch.

The Figma plugin main sandbox:

- is the only authority allowed to read or change the document;
- verifies the active file, page, selection, node IDs, style IDs, fingerprints,
  fonts, limits, and patch expiry;
- supports only Neue Montreal `Regular`, `Medium`, and `Bold`;
- enforces MAT semantic text-style roles for H1, H2, H3, Body, Button, and
  mobile/desktop labels;
- performs a complete preflight before the first write;
- rechecks fingerprints after loading every required font;
- verifies exact postconditions before completing the undo group;
- applies an approved batch as one Figma undo step;
- exports the required bounded post-apply PNG;
- maintains and verifies the short-lived safe undo window;
- triggers immediate rollback when an operation fails.

## MCP tools

| Tool | Effect |
| --- | --- |
| `mat_figma_status` | Reports bridge, pairing, and plugin state. |
| `mat_figma_pairing_code` | Returns the active six-digit pairing code. |
| `mat_figma_get_selection` | Reads exact selected nodes. |
| `mat_figma_get_node` | Reads one exact node and fingerprint. |
| `mat_figma_list_fonts` | Reads fonts visible to Figma Desktop. |
| `mat_figma_list_text_styles` | Reads local text styles and fingerprints. |
| `mat_figma_audit_typography` | Audits a selection, subtree, or current page. |
| `mat_figma_export_preview` | Returns a bounded PNG for an exact `nodeId`, or for the current selection when it contains exactly one node. |
| `mat_figma_propose_typography_patch` | Requires an exact post-apply preview target and opens a manual approval prompt; it does not write by itself. |
| `mat_figma_get_patch_status` | Reads or briefly waits for the patch result; an applied result automatically includes the PNG as MCP image content while structured JSON carries metadata without base64 bytes. |
| `mat_figma_cancel_patch` | Cancels a pending patch; it never undoes an applied patch. |

## Supported patch operations

- create a local text style;
- update or rename a local text style;
- bind a text node or exact text range to an existing or newly created style;
- change font role, size, line height, tracking, case, or decoration;
- replace characters only on a non-mixed text node;
- create a text node under an exact parent.

The bridge does not delete styles or nodes, detach components, upload font
files, accept raw JavaScript, or apply to an unresolved name-based scope.
Direct writes anywhere inside `COMPONENT`, `COMPONENT_SET`, or `INSTANCE` are
rejected in v0.1 because their propagated impact cannot be enumerated safely.
Full-text replacement uses Figma's style-preserving insertion/deletion APIs;
it never assigns `TextNode.characters` on an existing layer. When Figma Auto
Rename is active, the approval warns that the layer name will follow the new
content.

## Semantic text-style policy

When a local style uses a recognized MAT semantic name, its Neue Montreal role
is fixed:

| Semantic style | Required role |
| --- | --- |
| `H1` | `Bold` |
| `H2`, `H3`, `Button` | `Medium` |
| `Body`, `Body S` | `Regular` |
| mobile `Label` | `Regular` |
| desktop `Label` | `Medium` |

The matcher accepts the supported mobile/desktop namespace or matching suffix
forms and normalizes case and spacing. A create, update, rename, or bind
operation is rejected when a recognized semantic style would end with a
different role. Unknown names still remain subject to the general
Regular/Medium/Bold font policy. A range or new layer that links a style and
also supplies `fontRole` must match that style's projected final role,
including when the style is updated elsewhere in the same batch.

## Safety model

Each proposed batch has a unique ID, exact file and page, exact selection,
required preview target, five-minute expiry, immutable operations, and SHA-256
preconditions. Its approval summary includes every layer computed as affected
and identifies the target that will be captured after applying. Only one batch
can be pending at a time. A batch is rejected before writing when the document
changed, a font is missing, the file or selection differs, a target is locked
or unsupported, any operation would be a no-op, or any limit is exceeded.
No-op checks cover style updates, whole-node bindings, exact ranges, and text
replacement. A matching style ID alone is insufficient to call a binding a
no-op: divergent controlled values or supported typography overrides make
reapplying the style a valid normalization operation.

Pending approval expiry is checked whenever status is read and again
synchronously before approval, so an expired batch cannot enter the write
path. The main sandbox also uses explicit timers to arm and expire the safe
undo window. Main-sandbox and iframe typechecking use separate TypeScript
configurations so browser globals cannot leak back into the document process.

After a successful apply, the UI briefly moves from `settling` to an available
`Deshacer lote` button for the latest batch, for at most five minutes from the
apply. The action first verifies the post-apply fingerprints and style usages,
invokes the single native Figma Undo step, then verifies the original state. It
ignores only the plugin's exact local document events while settling. Once
available, any document event makes it unavailable; page changes, loss of
plugin focus, hiding the UI, a newer batch, expiry, or verification failure do
the same. Ownership is rechecked immediately before native Undo so an
invalidation that arrives during asynchronous verification cannot trigger a
stale rollback.

Apply-time document monitoring matches direct typography changes plus bounded
Auto Layout reflow effects on affected ancestors and every descendant in their
tracked subtrees, including descendants of siblings that use fill, hug, wrap,
or grid sizing. Remote changes, unexpected local properties, page changes, and
loss of plugin focus stop the batch. Before the first write this yields `stale`.
After a write it yields `indeterminate`, blocks later bridge writes, and
deliberately avoids automatic Undo because that could revert the user's
concurrent edit. Only the exact properties approved for existing nodes and
styles are accepted as plugin-owned; newly created objects do not receive a
broad property exemption. The applying guard remains active while the bridge
decides whether rollback is safe, so a late concurrent event cannot be lost
between the original failure and that decision. Ordinary operation errors
without concurrent activity use automatic rollback only after the expected
forward events and state have settled.
Before postconditions, preview export, rollback, or custom Undo, the bridge
compares the proposal fingerprints, created objects, and style usages to prove
that Figma actually changed the document. A failed or ignored write that left
the document unchanged never calls native Undo. If the comparison itself cannot
be completed, the bridge blocks later writes instead of guessing.

Figma batches `documentchange` notifications asynchronously and publishes no
maximum delivery latency. The bridge therefore requires an observed expected
event, a bounded quiet interval, and repeated fingerprint verification before
automatic or user-requested Undo completes. If the event stream does not settle
within the safety timeout, the bridge leaves the result indeterminate and
blocks later writes instead of claiming a confirmed rollback. The disposable
Figma smoke test remains mandatory evidence for this boundary.

Text properties bound to Figma variables are preserved. A patch is rejected
only when it would overwrite a bound typography field. Applying an existing
text style is rejected when that style itself has typography-variable
bindings, because v0.1 cannot prove the resolved font role.

Hyperlinks are preserved by refusing operations whose Figma behavior is not
documented strongly enough to prove preservation. Whole-node style rebinding,
range style rebinding, and full content replacement are rejected before
writing when their target range contains a hyperlink. Typography-only range
setters that do not rebind a style remain supported.

Limits:

- 100 operations;
- 500 affected or Auto Layout context nodes;
- 100,000 UTF-16 code units supplied by one patch;
- 1,000 text nodes per audit;
- 512 KiB per JSON message;
- 8 MiB WebSocket payload, allowing a bounded PNG to travel internally as
  base64 before the MCP server removes it from structured JSON;
- 1,280 px maximum preview dimension;
- 4 MiB maximum PNG.

Credentials are local:

- the server stores only a SHA-256 token digest under
  `%LOCALAPPDATA%\MAT Pilates\Figma Bridge\`;
- the plugin stores the token in `figma.clientStorage`;
- pairing codes expire after five minutes;
- five failed attempts impose a temporary lock;
- tokens, pairing codes, document text, and image bytes are not logged.

`get_node` and `get_selection` expose the exact container fingerprint required
by `create_text_node`, including for a page parent. A `get_node` request above
1,000 descendant text nodes is rejected explicitly rather than returning a
silently truncated or schema-invalid precondition. Explicit x/y placement for
a new child of an Auto Layout container is rejected in v0.1. Creating a text
node directly inside a Grid container is also rejected in v0.1.

Text fingerprints include complete-style paragraph settings plus position and
dimensions. The proposal also snapshots affected Auto Layout roots and each
ancestor's full descendant subtree, including child order, geometry, padding,
spacing, sizing, and alignment. The traversal includes descendants of siblings
and is rejected if the context exceeds 500 nodes. A subtree insertion or layout
edit while approval is pending therefore becomes `stale` before the first
write, and rollback verification checks the same layout context.

The model protects the bridge from external network access, unrelated web
pages, and malformed MCP input. It does not protect against a malicious process
already running as the same Windows user.

Audited text, typography metadata, and previews are transmitted to Codex only
when the corresponding tool is called. The bridge does not persist that
document content.

RPC cancellation is best-effort. The server stops waiting and ignores the
late response, but a read-only audit or preview already executing in Figma may
finish. Patch cancellation applies only while the batch is still awaiting
approval. After `Aplicar`, the plugin may expose the separately verified,
short-lived `Deshacer lote` action described above; ordinary Figma Undo remains
the underlying document operation.

The preview-target precondition fingerprints identity, parent, type, name,
visibility, locking, and dimensions. It is not a full visual hash of every
descendant. The rendered post-apply PNG and a fresh audit of the exact scope are
the authoritative visual validation evidence.

## Verification boundary

Automated checks validate schemas, per-method outputs, pairing, WebSocket
isolation, FIFO request lifecycles, fingerprints, limits, dependency audit,
semantic role mappings, affected-node summaries, PNG metadata and MCP image
content, undo invalidations, and production bundles. The write path must also
be exercised manually in a disposable copy of a Figma file before it is used
on MAT Foundations.

The first production operation on Foundations remains a separate, explicit
user decision.
