// Office shim for the page-editor's TgvV5Nav catalog block (mono a89dd0b, v5-parity).
// The REAL hook lives in the consuming Village app (tgv.com src/lib/domains/navigation/…);
// Office only renders TgvV5Nav inside the Sandbox/Catalog preview, where there is no
// member account cluster — the block always renders its signed-out state here.
export type NavAccount = { username?: string; href?: string } | null;

export function useNavAccount(): { account: NavAccount } {
  return { account: null };
}
