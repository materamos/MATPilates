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
production smoke test exercises that exact dependency combination.

## Import the Figma plugin

1. Open Figma Desktop.
2. Open **Plugins > Development > Import plugin from manifest**.
3. Select `dist/plugin/manifest.json`.
4. Open the MAT file or a disposable copy.
5. Run **MAT — Codex Bridge** from development plugins.

The plugin must stay open while Codex uses the bridge.

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

The issued token replaces an older token. To remove the local relationship:

```powershell
npm run reset-pairing
```

Then choose **Olvidar vínculo** in the Figma plugin.

## Safe workflow

1. Inspect with `get_selection`, `get_node`, `list_fonts`,
   `list_text_styles`, or `audit_typography`.
2. Export a preview when visual confirmation matters.
3. Ask Codex for one exact proposed patch.
4. Review every exact style, layer, range, typography value, and text preview
   listed in the Spanish Figma prompt.
5. Press `Aplicar` or `Rechazar`.
6. Ask Codex for the patch status and re-audit the exact scope.
7. Use Figma's native Undo immediately if the applied result is not wanted.

The proposal tool never writes without the manual Figma confirmation.
Requests are serialized in FIFO order. Cancelling a Codex tool call is
best-effort: it stops waiting locally, but an audit or preview already running
inside Figma may finish and have its result discarded. A pending patch can be
cancelled; an applying or applied patch cannot.

## Manual write validation

Use a disposable file copy and verify:

- Regular, Medium, and Bold are reported available;
- unsupported Semibold/600 input is rejected;
- rejecting a proposal changes nothing;
- editing a target between proposal and approval yields `stale`;
- mixed formatting survives exact-range changes;
- full-text replacement preserves the existing uniform style through
  `insertCharacters`/`deleteCharacters`;
- typography fields bound to Figma variables are rejected only when the
  proposed operation would overwrite those fields;
- an injected or natural operation failure returns a rolled-back state;
- a postcondition mismatch returns a rolled-back state;
- a successful batch appears as one Figma Undo step;
- undo restores the pre-patch result;
- the bridge remains bound only to `127.0.0.1:3847`.

Do not use MAT Foundations for the first write-path test.
