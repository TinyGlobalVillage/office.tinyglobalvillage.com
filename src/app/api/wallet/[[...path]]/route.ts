// Office wallet proxy → tinyglobalvillage.com (money-keystone). The Wallet tile's panel calls
// Office's own /api/wallet/*; this catch-all forwards each call to HQ acting as THE BUSINESS
// member (see wallet-bridge). Office never holds the Stripe key and never touches the ledger —
// the shared platform ledger stays single-writer on HQ.
import { createWalletProxy } from "@tgv/module-wallet/proxy";
import { businessMemberIfOperator } from "@/lib/wallet-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = createWalletProxy({
  getMemberId: businessMemberIfOperator,
});
