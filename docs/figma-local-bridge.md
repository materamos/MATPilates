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
  │ authenticated WebSocket on 127.0.0.1:3847
  ▼
Figma plugin UI
  │ validated postMessage
  ▼
Figma plugin main sandbox
  └─ local fonts, document reads, preview, manual patch approval
```

The server and Figma plugin share protocol version `1`. The WebSocket endpoint
is fixed at `ws://127.0.0.1:3847/mat-figma-bridge` with subprotocol
`mat-figma-bridge.v1`. It never falls back to another interface or port.

## Responsibilities

The local server:

- exposes eleven narrow MCP tools over STDIO;
- reserves stdout for MCP and writes only sanitized diagnostics to stderr;
- listens only on IPv4 loopback;
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
  replacement-text preview in that approval;
- requires an explicit `Aplicar` or `Rechazar` decision for every batch.

The Figma plugin main sandbox:

- is the only authority allowed to read or change the document;
- verifies the active file, page, selection, node IDs, style IDs, fingerprints,
  fonts, limits, and patch expiry;
- supports only Neue Montreal `Regular`, `Medium`, and `Bold`;
- performs a complete preflight before the first write;
- rechecks fingerprints after loading every required font;
- verifies exact postconditions before completing the undo group;
- applies an approved batch as one Figma undo step;
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
| `mat_figma_export_preview` | Returns a bounded local PNG preview. |
| `mat_figma_propose_typography_patch` | Opens a manual approval prompt; it does not write by itself. |
| `mat_figma_get_patch_status` | Reads or briefly waits for the patch result. |
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
Full-text replacement uses Figma's style-preserving insertion/deletion APIs;
it never assigns `TextNode.characters` on an existing layer.

## Safety model

Each proposed batch has a unique ID, exact file and page, exact selection,
five-minute expiry, immutable operations, and SHA-256 preconditions. Only one
batch can be pending at a time. A batch is rejected before writing when the
document changed, a font is missing, the file or selection differs, a target
is locked or unsupported, or any limit is exceeded.

The main Figma sandbox has no browser timers. Expiry is therefore checked
whenever status is read and again synchronously before approval; no expired
batch can enter the write path. Main-sandbox and iframe typechecking use
separate TypeScript configurations so browser globals cannot leak back into
the document process.

Text properties bound to Figma variables are preserved. A patch is rejected
only when it would overwrite a bound typography field. Applying an existing
text style is rejected when that style itself has typography-variable
bindings, because v0.1 cannot prove the resolved font role.

Limits:

- 100 operations;
- 500 directly affected nodes;
- 100,000 UTF-16 code units supplied by one patch;
- 1,000 text nodes per audit;
- 512 KiB per JSON message;
- 8 MiB WebSocket payload, allowing a bounded PNG to travel as base64;
- 1,280 px maximum preview dimension;
- 4 MiB maximum PNG.

Credentials are local:

- the server stores only a SHA-256 token digest under
  `%LOCALAPPDATA%\MAT Pilates\Figma Bridge\`;
- the plugin stores the token in `figma.clientStorage`;
- pairing codes expire after five minutes;
- five failed attempts impose a temporary lock;
- tokens, pairing codes, document text, and image bytes are not logged.

The model protects the bridge from external network access, unrelated web
pages, and malformed MCP input. It does not protect against a malicious process
already running as the same Windows user.

Audited text, typography metadata, and previews are transmitted to Codex only
when the corresponding tool is called. The bridge does not persist that
document content.

RPC cancellation is best-effort. The server stops waiting and ignores the
late response, but a read-only audit or preview already executing in Figma may
finish. Patch cancellation applies only while the batch is still awaiting
approval; once `Aplicar` is pressed, native Undo is the recovery boundary.

## Verification boundary

Automated checks validate schemas, per-method outputs, pairing, WebSocket
isolation, FIFO request lifecycles, fingerprints, limits, dependency audit,
PNG metadata, and production bundles. The write path must also be exercised
manually in a disposable copy of a Figma file before it is used on MAT
Foundations.

The first production operation on Foundations remains a separate, explicit
user decision.
