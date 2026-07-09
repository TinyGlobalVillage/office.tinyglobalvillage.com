// Office shim for the page-editor's TgvV5Nav catalog block (mono a89dd0b, v5-parity).
// The REAL hook lives in the consuming Village app (tgv.com src/lib/domains/support/…);
// in the Office Sandbox preview the "Get Support" modal is inert.
export function useSupportModal(): {
  supportOpen: boolean;
  openSupport: () => void;
  closeSupport: () => void;
} {
  return { supportOpen: false, openSupport: () => {}, closeSupport: () => {} };
}
