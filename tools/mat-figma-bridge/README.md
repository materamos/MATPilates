# MAT Figma Local Bridge

Local MCP server and Figma Desktop development plugin for font-safe MAT
typography work.

## Requirements

- Windows with Figma Desktop;
- Node.js 20.9 or later;
- Neue Montreal `Regular`, `Medium`, and `Bold` installed and visible to Figma;
- a trusted local Codex project.

## Build and check

From this directory:

```powershell
npm install
npm run check
```

The build creates unversioned files under `dist/`:

- `dist/server/index.js`;
- `dist/plugin/manifest.json`;
- `dist/plugin/code.js`;
- `dist/plugin/ui.html`.

The MCP SDK is pinned to `1.29.0`. Its unused HTTP adapter is overridden to
`@hono/node-server@2.0.11` because the compatible 1.x line has a Windows path
traversal advisory. This bridge exposes only the SDK's STDIO transport; the
contract tests exercise it with the SDK's in-memory transport, and the build
validates the production server and plugin bundles.

## Import the Figma plugin

1. Open Figma Desktop.
2. Open **Plugins > Development > Import plugin from manifest**.
3. Select `dist/plugin/manifest.json`.
4. Open the MAT file or a disposable copy.
5. Run **MAT — Codex Bridge** from development plugins.

The plugin must stay open while Codex uses the bridge.

Figma's development manifest accepts the local client endpoint as
`localhost:3847`. The Node server binds only to the explicit IPv4 and IPv6
loopback addresses `127.0.0.1:3847` and `[::1]:3847`; it is never exposed on
the LAN.

## Connect Codex

The Codex desktop app, CLI, and IDE extension share MCP configuration. Add this
STDIO server in Codex settings, or copy the values from
`codex-config.example.toml` into the personal `config.toml`:

```toml
[mcp_servers.mat_figma_bridge]
enabled = true
required = false
command = "node"
args = ["C:\\Dev\\repos\\active\\MAT Pilates\\tools\\mat-figma-bridge\\dist\\server\\index.js"]
startup_timeout_sec = 10.0
tool_timeout_sec = 65.0
```

Restart Codex after changing MCP configuration.

## Pair

1. Ask Codex to call `mat_figma_pairing_code`.
2. Enter the six-digit code in the Figma plugin within five minutes.
3. Confirm that the plugin shows `Conectado`.
4. Ask Codex to call `mat_figma_status` and
   `mat_figma_list_fonts` with `family: "Neue Montreal"`.

The issued token replaces an older token. To remove the local relationship,
choose **Olvidar vínculo** in the Figma plugin, then run:

```powershell
npm run reset-pairing
```

That command removes credentials from disk only. Restart Codex (or otherwise
restart the running MCP server) to clear its in-memory token and socket. All
three steps are required for complete revocation.

## Safe workflow

1. Inspect with `get_selection`, `get_node`, `list_fonts`,
   `list_text_styles`, or `audit_typography`.
2. Export a preview by exact `nodeId`, or omit it when the current selection
   contains exactly one node.
3. Ask Codex for one exact proposed patch with the required post-apply preview
   target.
4. Review every exact style, operation, affected layer, range, typography
   value, bounded whitespace-normalized text preview (including its truncation
   marker), and preview target listed in the Spanish Figma prompt.
5. Press `Aplicar` or `Rechazar`.
6. Ask Codex for the patch status. An applied result automatically includes
   the post-apply PNG as MCP image content; structured JSON contains its
   metadata, not base64 image bytes.
7. Re-audit the exact scope. If the latest applied batch is not wanted, use
   `Deshacer lote` while the plugin still marks that action as available.

The proposal tool never writes without the manual Figma confirmation. Mutating
requests are serialized in FIFO order; patch-status reads and apply-time safety
signals bypass that queue so a long apply cannot hide its current state.
Cancelling a Codex tool call is best-effort: it stops waiting locally, but an
audit or preview already running inside Figma may finish and have its result
discarded. A pending patch can be cancelled through MCP; an applying or applied
patch cannot. The UI's `Deshacer lote` action is separate and deliberately
ephemeral: it verifies the latest post-apply state, invokes the single native
Figma Undo step, and verifies the restored pre-patch state. It is armed only
after the plugin's exact local document events settle and remains available for
at most five minutes. Once available, any subsequent document event disables
it; page changes, loss of plugin focus, hiding the UI, a newer batch, expiry,
or failed verification also disable it.

Direct writes anywhere inside `COMPONENT`, `COMPONENT_SET`, or `INSTANCE` are
rejected in v0.1 because the bridge cannot enumerate their propagation safely.
Creating a text node directly inside a Grid container is also rejected.
When a range or new node links a text style and also supplies `fontRole`, that
role must match the style's projected final role, including a style updated
elsewhere in the same batch.

If focus or another unexpected document event occurs before the first write,
the batch becomes stale. If it occurs after a write, the bridge stops,
marks the result indeterminate, blocks later writes, and does not call native
Undo automatically because doing so could revert the user's concurrent edit.
The file must then be reviewed and, if appropriate, reverted with Figma's
native Undo.

Apply-time document events are matched against exact approved properties for
existing nodes and styles; there is no broad same-target exception. The
applying guard remains active through the rollback decision so a delayed
concurrent event cannot fall into an unmonitored gap.

The bridge rejects operations that already match Figma exactly. A node or range
with the same style ID but divergent controlled values or supported
typographic overrides is not treated as a no-op: reapplying the style is an
intentional normalization. Hyperlinks are different: v0.1 rejects whole-node
style rebinding, range style rebinding, and full content replacement when the
target contains a hyperlink, because the Figma API does not guarantee that
those operations preserve it. The bridge also proves that at least one proposal
fingerprint, created object, or style usage changed before postconditions,
preview export, rollback, or `Deshacer lote` can invoke native Undo. An ignored
write or a failure before the first real document change cannot consume the
user's previous Undo entry. If that proof cannot be completed, later bridge
writes remain blocked.

Figma batches `documentchange` asynchronously without a documented maximum
latency. Automatic rollback and `Deshacer lote` therefore require a bounded
quiet interval plus repeated fingerprint checks. If those checks do not settle
within the timeout, the bridge reports an indeterminate result and blocks later
writes. This conservative timeout is why the disposable-file smoke test is a
required release gate rather than an optional demo.

Pending text writes snapshot their Auto Layout roots and each ancestor's full
descendant subtree, including sibling descendants that can reflow through
fill, hug, wrap, or grid sizing. Child order, geometry, padding, spacing,
sizing, and alignment are covered, with the whole context bounded by the
500-node patch limit. Concurrent subtree or layout changes therefore invalidate
the patch before it writes, and the same context is checked after rollback.

## Semantic text-style policy

Recognized MAT semantic text-style names must use these Neue Montreal roles:

| Semantic style | Required role |
| --- | --- |
| `H1` | `Bold` |
| `H2`, `H3`, `Button` | `Medium` |
| `Body`, `Body S` | `Regular` |
| mobile `Label` | `Regular` |
| desktop `Label` | `Medium` |

The policy accepts the supported mobile/desktop namespace or matching suffix
forms. Creating, updating, renaming, or binding a recognized semantic style is
rejected when its resulting font role does not match this table. Semibold/600
remains unsupported.

`get_node` and `get_selection` expose a container fingerprint when that node can
be the explicit parent of a new text layer. A single `get_node` scope above
1,000 descendant text nodes is rejected instead of returning an invalid,
silently truncated precondition.

## Manual write validation

Use a disposable file copy and verify:

- Regular, Medium, and Bold are reported available;
- unsupported Semibold/600 input is rejected;
- semantic H1/H2/H3/Body/Button/Label mappings reject a mismatched role;
- a proposal without an exact preview target is rejected;
- the approval summary lists every affected layer and the preview target;
- `export_preview` accepts an exact node ID or the current single-node
  selection;
- rejecting a proposal changes nothing;
- editing a target between proposal and approval yields `stale`;
- inserting a sibling or changing any tracked descendant in its bounded Auto
  Layout context before approval yields `stale`;
- creating text directly inside Grid is rejected;
- exact no-op style, binding, range, and content operations are rejected
  without creating or consuming an Undo entry, while same-style bindings with
  supported residual typography overrides remain valid normalization
  operations;
- style rebinding or full content replacement on hyperlinked text is rejected
  before writing;
- mixed formatting survives exact-range changes;
- full-text replacement preserves the existing uniform style through
  `insertCharacters`/`deleteCharacters`;
- typography fields bound to Figma variables are rejected only when the
  proposed operation would overwrite those fields;
- an injected or natural operation failure returns a rolled-back state;
- a postcondition mismatch returns a rolled-back state;
- a successful batch appears as one Figma Undo step;
- `get_patch_status` returns the automatic PNG as MCP image content without
  placing base64 bytes in structured JSON;
- `Deshacer lote` restores and verifies the pre-patch result while available,
  and invalidates on the documented safety boundaries;
- losing focus or receiving an unexpected document event during apply stops
  the batch without a potentially destructive automatic Undo;
- the bridge remains bound only to `127.0.0.1:3847` and `[::1]:3847`.

Do not use MAT Foundations for the first write-path test.

The preview-target fingerprint protects target identity, page, visibility,
locking, name, and dimensions; it is not a full subtree-render hash. The actual
post-apply PNG plus a fresh audit of the exact scope are the visual validation
evidence.
