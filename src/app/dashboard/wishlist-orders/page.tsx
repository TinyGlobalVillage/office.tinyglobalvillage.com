// wishlist-orders/page.tsx — SERVER component. Staff gate for the Wishlist orders queue (Gio 2026-11-23):
// visitors who chose "Add to cart" on a wishlist paid TGV; staff buy the item and ship it to the list's
// owner. Same staff test as /api/admin/wishlist-orders (requireStaff) and the tile (staffOnly).
import { getBridgedMember } from "@/lib/member-auth/bridge";
import { isStaffRole } from "@/lib/api-staff";
import WishlistOrdersClient from "./WishlistOrdersClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WishlistOrdersPage() {
  const member = await getBridgedMember();
  if (!member || !isStaffRole(member.role)) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Staff only</div>
        <div style={{ fontSize: "0.85rem", maxWidth: "28rem", opacity: 0.75 }}>Wishlist orders are TGV&apos;s buying queue. It&apos;s open to TGV staff only.</div>
      </div>
    );
  }
  return <WishlistOrdersClient />;
}
