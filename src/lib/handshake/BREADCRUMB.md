# handshake — breadcrumb

> Status: verified · 2026-09-01

**One-liner:** Read-only window onto Gio's self-custodied Handshake holdings — HNS
balance, deposit addresses, and the six TLDs he owns — for the Villagers → Handshake tile.

**Stack / runtime:** TypeScript, Node runtime only (the API route is `force-dynamic`).
**Chain source:** public hsd node `https://api.handshakeapi.com/hsd` (v2.3.0, mainnet,
address-indexed). Swap `hsdUrl` in the config to point at a private hsd later — nothing
else changes.
**Source-of-truth files:** `data/handshake/handshake.json` (the operator's config;
addresses + watched names), the chain itself for everything else.

## Deposit-only, structurally
There is no signer, no key material, and no transaction builder anywhere under this dir —
not a flag that could be flipped. `normalizeConfig()` additionally force-sets
`withdrawalsEnabled: false` server-side regardless of the payload, so a hand-edited file
or a forged PUT can't turn it on. Gio signs every withdrawal, transfer, finalize and
renewal in his own wallet; Office only watches and alarms.

## Key files
- `types.ts` — the `HnsChainSource` contract + unit/consensus constants
  (`DOO_PER_HNS` 1e6, `BLOCK_SECONDS` 600, `RENEWAL_WINDOW_BLOCKS` 105_000,
  `TRANSFER_LOCKUP_BLOCKS` 288). Deliberately has no send/sign/transfer method.
- `hsdSource.ts` — `createHsdSource(baseUrl, apiKey?)`. hsd auth is HTTP basic with an
  EMPTY username and the API key as password. Balances are fetched one address at a time
  and errors are surfaced per-address, so a typo shows up in Office before it's pasted
  into a withdrawal form.
- `config.ts` — read/normalize/write `handshake.json`; falls back to `SEED_CONFIG` on a
  missing or corrupt file so a bad write can never lock the operator out.

## Consumers
- `src/app/api/villagers/handshake/route.ts` — GET (config + tip + balances + QR + name
  info, `requireAdmin`) and PUT (config save, audit-logged). No POST: nothing moves.
- `src/app/components/villagers/HandshakeModal.tsx` — the tile's modal (three ADDMs,
  gold accent, all default-closed).

## Related
- Namebase custodial sunset: everything must be withdrawn/transferred before 2026-10-01.
- TRANSFER → 288-block lockup → FINALIZE, and **the sender finalizes** — Namebase has to
  complete the second leg, so don't start a TLD transfer near the deadline.
