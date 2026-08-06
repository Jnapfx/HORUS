# HORUS operator application

Local-first Electron application for the sole HORUS operator.

## Commands

From this directory:

```sh
npm install
npm run dev
npm test
npm run build
npm run lint
```

`npm run dev` starts the Vite renderer on `http://127.0.0.1:5173` and opens the Electron shell. The renderer has no Node integration and receives only the explicitly exposed preload API.

## Local data boundary

At runtime, Electron creates its data directory under the operating-system application-data location. The SQLite database stores derived records and append-only domain events. Raw source responses are content-addressed JSON files in the adjacent `raw/` directory and are never overwritten.

No credentials, source snapshots, or SQLite files belong in the repository.

## Current scope

The foundation intentionally contains no live external integration. SerpApi, PageSpeed, Gmail compose-handoff, and Cloudflare Dashboard upload have non-production contracts behind the Electron main-process boundary; they generate no network requests and expose no credentials to the renderer. Gmail API credentials are prohibited by DEC-041. A compose handoff also requires an outreach approval ID and a syntactically valid recipient address before it can open Gmail.
