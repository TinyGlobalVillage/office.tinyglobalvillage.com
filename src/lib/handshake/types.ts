// Handshake (HNS) chain-reading contract.
//
// Office NEVER holds a private key. Everything here is READ-ONLY by
// construction: there is no signer, no key material, and no transaction
// builder anywhere under src/lib/handshake. Gio's coins and TLDs live in a
// wallet he controls (Bob Wallet / hsd); these types describe what Office is
// allowed to *look at*.
//
// The source is an interface on purpose. Today it is a public hsd REST/RPC
// node; the day Gio runs his own hsd the URL changes and nothing else does.

/** Handshake's smallest unit. 1 HNS = 1,000,000 dollarydoos. */
export const DOO_PER_HNS = 1_000_000;

/** Handshake targets a 10-minute block. Used to turn block counts into dates. */
export const BLOCK_SECONDS = 600;

/** A registered name must be renewed within this many blocks (~2 years). */
export const RENEWAL_WINDOW_BLOCKS = 105_000;

/** A TRANSFER cannot be FINALIZEd until this many blocks have passed (~2 days). */
export const TRANSFER_LOCKUP_BLOCKS = 288;

export type HnsNameInfo = {
  name: string;
  /** hsd's auction state: OPENING · BIDDING · REVEAL · CLOSED · REVOKED … */
  state: string;
  /** CLOSED with a live owner UTXO — i.e. somebody holds it right now. */
  owned: boolean;
  /** Height the current registration was last renewed at. */
  renewalHeight: number | null;
  /** renewalHeight + RENEWAL_WINDOW_BLOCKS. */
  expiryHeight: number | null;
  blocksUntilExpiry: number | null;
  /** Estimated wall-clock expiry, ISO. Block time is a target, not a promise. */
  expiresAt: string | null;
  /** Height the pending TRANSFER was mined at; null when none is pending. */
  transferHeight: number | null;
  /** Height at which FINALIZE becomes legal (transferHeight + lockup). */
  finalizeHeight: number | null;
  /** True when a transfer is pending AND its lockup has elapsed. */
  finalizeReady: boolean;
  /** Raw resource-record hex as published on-chain, if any. */
  recordHex: string | null;
};

export type HnsAddressBalance = {
  address: string;
  /** Sum of the address's unspent coins, in dollarydoos. */
  doos: number;
  /** How many UTXOs back that sum. */
  coins: number;
  /** Set when the chain source rejected the address — usually a typo. */
  error?: string;
};

/**
 * A read-only window onto the Handshake chain.
 *
 * Deliberately has no send/sign/transfer method. Adding one would require a
 * signer, and a signer would require keys in Office — which is the thing this
 * whole surface exists to avoid.
 */
export type HnsChainSource = {
  kind: "hsd";
  label: string;
  /** Current chain tip. Every "blocks until…" number is relative to this. */
  height(): Promise<number>;
  balance(addresses: string[]): Promise<HnsAddressBalance[]>;
  nameInfo(name: string, tipHeight: number): Promise<HnsNameInfo>;
};

export function doosToHns(doos: number): number {
  return doos / DOO_PER_HNS;
}

/** Turn a block count into an estimated ISO timestamp from now. */
export function blocksToIso(blocks: number, from = Date.now()): string {
  return new Date(from + blocks * BLOCK_SECONDS * 1000).toISOString();
}
