/**
 * Published atom specs, injected into every Office page.
 *
 * The Atom Library publishes to tgv_db; this reads what is live and drops one
 * rule per atom of `--atom-*` variables into the HTML. Shipped atoms already
 * read those names ahead of their baked values, so an atom changes on the next
 * page load rather than the next deploy. tinyglobalvillage.com and
 * refusionist.com mount the same component against their own pool.
 *
 * Everything is loaded dynamically and every failure returns null: no
 * DATABASE_URL, no table, no rows and no connection all mean the same thing —
 * the atoms render the spec that shipped with the code. A styling channel is
 * not worth a root layout that can fail to render.
 */
import React from "react";

export default async function AtomSpecStyles() {
  try {
    const [{ pgPool }, { default: AtomStyles }] = await Promise.all([
      import("@/lib/pg-pool"),
      import("@tgv/module-component-library/atoms/AtomStyles"),
    ]);
    return <AtomStyles db={pgPool} />;
  } catch {
    return null;
  }
}
