// /api/esign/documents — Office E-Sign document library (origin = 'office').
//
//   GET  → list Office-origin signable docs (+ shareable direct-link URL, kind, and — for
//          multisig — the per-signer roster) + the staff roster (recipient picker source).
//   POST → upload a PDF (multipart: file + title [+ kind + signers]). kind='waiver' (default):
//          create a Documenso direct-link template (one reusable link). kind='multisig':
//          Documenso DOCUMENT flow — named recipients each get their own signing link at
//          upload time (create → recipients → fields → distribute NONE), roster tracked in
//          public.legal_document_signers. OFFICE sends the invitation, not Documenso: its
//          own invite email is a compiled template the operator cannot curate, so we
//          distribute silently and mail the message written in the gear panel. Admin-only.
//
// Reuses the @tgv/module-legal/module-documenso engine wholesale — Office just scopes by origin.
import { type NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { listIdentities } from "@/lib/fastmail";
import { tokenForUser } from "@/lib/fastmail-token";
import {
  isDocumensoConfigured,
  createDirectLinkTemplateFromPdf,
  directLinkUrl,
  listOfficeLegalDocuments,
  createOfficeLegalDocument,
  setDocumensoTemplate,
  deactivateOfficeLegalDocument,
  getMemberByEmail,
  insertLegalSend,
  getPdfPageCount,
} from "@tgv/module-documenso";
import {
  createAndDistributeMultisigFromPdf,
  retireMultisigDocument,
} from "@tgv/module-documenso/server/multisig";
import {
  inviteTemplateFrom,
  renderSigningInvite,
  signingUrl,
} from "@tgv/module-documenso/server/invite";
import {
  markLegalDocumentMultisig,
  insertLegalDocumentSigners,
  listLegalDocumentKinds,
  listSignersForDocuments,
  markSignerSentByEmail,
  setLegalDocumentCertPrefs,
  setLegalDocumentDelivery,
  setLegalDocumentInvite,
  rememberSigningToken,
  rememberSignerFieldPlan,
  type InsertSignerInput,
} from "@tgv/module-documenso/db/multisig-queries";
import { sendMail } from "@/lib/email/sendMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB — matches Documenso practical template limit
const MAX_SIGNERS = 10; // field stacking compresses rows; past ~10 the last page gets crowded
const MAX_DELIVERY = 10; // addresses the signed document is delivered to on completion
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where a signer lands after signing. Must be PUBLIC — Office is proxy-gated behind a member
// session, so a signer sent here would meet a login wall; the page lives on tgv.com. Unset,
// Documenso shows its own post-sign screen, which invites the signer to claim an account.
const SIGN_COMPLETE_URL = process.env.ESIGN_SIGN_COMPLETE_URL || "https://tinyglobalvillage.com/sign/complete";

// Where a recipient's reply lands when the operator doesn't name one. A monitored mailbox,
// never no-reply@ — see the reply-to note at the POST parse below.
const DEFAULT_REPLY_TO = process.env.ESIGN_REPLY_TO || "support@tinyglobalvillage.com";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "document";
}

type StaffEntry = { email: string; role: string; terminalAccess?: boolean };

async function readStaff(): Promise<Array<{ username: string; email: string; role: string }>> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "office-staff.json"), "utf8");
    const roster = JSON.parse(raw) as Record<string, StaffEntry>;
    return Object.entries(roster)
      .filter(([, v]) => v?.email)
      .map(([username, v]) => ({ username, email: v.email, role: v.role }))
      .sort((a, b) => a.username.localeCompare(b.username));
  } catch {
    return [];
  }
}

/**
 * Every address this operator may put on the delivery list without typing it: their Fastmail
 * sending identities plus their roster address, deduped, roster address first. Fastmail is
 * the source of truth (Gio's 17 identities span four domains), so the picker never drifts
 * from what he can actually receive at. Failures degrade to the roster address alone —
 * an address picker is never worth failing a page load over.
 */
async function addressesForUser(username: string, rosterEmail: string): Promise<string[]> {
  const primary = rosterEmail.toLowerCase();
  const token = tokenForUser(username);
  if (!token) return [primary];
  try {
    const identities = await listIdentities(token);
    const seen = new Set([primary]);
    const rest = identities.map((i) => i.email).filter((e) => !seen.has(e) && (seen.add(e), true));
    rest.sort();
    return [primary, ...rest];
  } catch {
    return [primary];
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const [docs, staff] = await Promise.all([listOfficeLegalDocuments(db), readStaff()]);

  // Layer on kind (0076) + the signer roster for multisig docs — two bulk queries, no N+1.
  const kindRows = await listLegalDocumentKinds(db, docs.map((d) => d.id));
  const kindById = new Map(kindRows.map((k) => [k.id, k.kind]));
  const multisigIds = docs.filter((d) => kindById.get(d.id) === "multisig").map((d) => d.id);
  const signerRows = await listSignersForDocuments(db, multisigIds);
  const signersByDoc = new Map<string, typeof signerRows>();
  for (const s of signerRows) {
    const list = signersByDoc.get(s.legalDocumentId) ?? [];
    list.push(s);
    signersByDoc.set(s.legalDocumentId, list);
  }

  const documents = docs.map((d) => {
    const kind = kindById.get(d.id) ?? "waiver";
    const signers = (signersByDoc.get(d.id) ?? []).map((s) => ({
      email: s.signerEmail,
      name: s.signerName,
      status: s.status,
      signedAt: s.signedAt,
    }));
    return {
      id: d.id,
      title: d.title,
      slug: d.slug,
      version: d.version,
      kind,
      // multisig docs have no shareable link — they're distributed to named signers at upload
      sendable: kind === "waiver" && Boolean(d.documensoTemplateId && d.documensoDirectToken),
      shareUrl: kind === "waiver" && d.documensoDirectToken ? directLinkUrl(d.documensoDirectToken) : null,
      signers: kind === "multisig" ? signers : undefined,
      signedCount: kind === "multisig" ? signers.filter((s) => s.status === "signed").length : undefined,
      signerCount: kind === "multisig" ? signers.length : undefined,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
  // `me` seeds the New Document delivery list: the operator sending a document is nearly
  // always one of the people the signed copy has to reach, and the list is only useful if
  // the common case needs no typing. `addresses` is every address they can pick as that
  // seed — their Fastmail sending identities (the same list Fastmail's own compose window
  // offers, so nothing to hand-maintain) unioned with the roster email, roster email first.
  // No Fastmail token means no identities: the picker degrades to the one roster address.
  const rosterMe = staff.find((s) => s.username === auth.username) ?? null;
  const me = rosterMe ? { ...rosterMe, addresses: await addressesForUser(auth.username, rosterMe.email) } : null;
  return NextResponse.json({ ok: true, configured: isDocumensoConfigured(), documents, staff, me });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  if (!isDocumensoConfigured()) {
    return NextResponse.json({ error: "Documenso not configured (DOCUMENSO_URL + DOCUMENSO_API_KEY)" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data (file + title)" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: `PDF must be 1 byte–${MAX_PDF_BYTES / (1024 * 1024)} MB` }, { status: 400 });
  }

  const pdf = Buffer.from(await file.arrayBuffer());

  // kind branch (0076): default waiver; multisig carries a JSON signer roster.
  const kind = String(form.get("kind") ?? "waiver") === "multisig" ? "multisig" : "waiver";
  const note = String(form.get("note") ?? "").trim();
  // "Include certificate page?" (0079) — default true; false = the completion webhook
  // strips Documenso's appended certificate from the stored copy (sealed original kept).
  const includeCertificate = String(form.get("includeCertificate") ?? "true") !== "false";
  // Sequential is the default: Documenso emails only the first signer, then advances the
  // chain natively as each one signs. Completion mail is OURS now — Documenso sends none
  // (DOCUMENT_EMAIL_SETTINGS); deliveryEmails below is who actually receives the signed
  // document, and copyToSigners folds the whole roster into that list.
  const sequential = String(form.get("sequential") ?? "true") !== "false";
  const copyToSigners = String(form.get("finalCopyAll") ?? "false") === "true";
  // Email settings (gear panel): the whole signing invitation, subject to footer.
  //
  // Multisig invitations are OURS now. Documenso's invite is a compiled template — its
  // wordmark, "{sender} has invited you to sign …", "Continue by signing the document."
  // and the button label are not settings — so the document is distributed with
  // distributionMethod NONE and Office renders and sends the message the operator wrote.
  // These five fields ARE the email; blanks fall back to the module's defaults.
  const emailSubject = String(form.get("emailSubject") ?? "").trim().slice(0, 200);
  const inviteHeading = String(form.get("inviteHeading") ?? "").trim().slice(0, 120);
  const inviteButtonLabel = String(form.get("inviteButtonLabel") ?? "").trim().slice(0, 40);
  const inviteFooter = String(form.get("inviteFooter") ?? "").trim().slice(0, 200);
  // The signing page's two identity lines (gear → Signing page). A cleared field means
  // "leave that line off the page", so presence is read from the FIELD, never from its
  // value — an absent pair falls back to the house wording, an empty string does not.
  const journey =
    form.has("signEyebrow") || form.has("signTitle")
      ? {
          eyebrow: String(form.get("signEyebrow") ?? "").trim().slice(0, 60),
          title: String(form.get("signTitle") ?? "").trim().slice(0, 120),
        }
      : null;
  const replyToInput = String(form.get("emailReplyTo") ?? "").trim().toLowerCase();
  if (replyToInput && !EMAIL_RE.test(replyToInput)) {
    return NextResponse.json({ error: `Invalid reply-to email: "${replyToInput}"` }, { status: 400 });
  }
  // Left blank, reply-to still gets a real, monitored mailbox. An invite whose From is a
  // no-reply address and which offers nowhere to reply is a dead end to a human and a
  // spam signal to a filter; DEFAULT_REPLY_TO makes "just send it" the deliverable path.
  const emailReplyTo = replyToInput || DEFAULT_REPLY_TO;
  let signers: Array<{ email: string; name: string | null }> = [];
  let deliveryEmails: string[] = [];
  if (kind === "multisig") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("signers") ?? "[]"));
    } catch {
      return NextResponse.json({ error: "signers must be a JSON array" }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const raw of Array.isArray(parsed) ? parsed : []) {
      const email = String((raw as { email?: string })?.email ?? "").trim().toLowerCase();
      const name = String((raw as { name?: string })?.name ?? "").trim() || null;
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: `Invalid signer email: "${email}"` }, { status: 400 });
      }
      if (seen.has(email)) continue;
      seen.add(email);
      signers.push({ email, name });
    }
    if (!signers.length) {
      return NextResponse.json({ error: "Multi-signature documents need at least one signer" }, { status: 400 });
    }
    if (signers.length > MAX_SIGNERS) {
      return NextResponse.json({ error: `At most ${MAX_SIGNERS} signers per document` }, { status: 400 });
    }

    // Who receives the signed document when everyone has signed. Deliberately NOT deduped
    // against the signer roster: the operator is very often a signer AND the person the
    // finished document has to reach, which is the exact case the old CC list dropped.
    let deliveryParsed: unknown = [];
    try {
      deliveryParsed = JSON.parse(String(form.get("deliveryEmails") ?? form.get("ccRecipients") ?? "[]"));
    } catch {
      return NextResponse.json({ error: "deliveryEmails must be a JSON array" }, { status: 400 });
    }
    const seenDelivery = new Set<string>();
    for (const raw of Array.isArray(deliveryParsed) ? deliveryParsed : []) {
      const email = String(
        typeof raw === "string" ? raw : (raw as { email?: string })?.email ?? "",
      ).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: `Invalid delivery email: "${email}"` }, { status: 400 });
      }
      if (seenDelivery.has(email)) continue;
      seenDelivery.add(email);
      deliveryEmails.push(email);
    }
    // "Also send it to everyone who signed" folds the roster into the same one list, so
    // there is a single answer to "who gets this document" rather than two half-answers.
    if (copyToSigners) {
      for (const s of signers) {
        if (seenDelivery.has(s.email)) continue;
        seenDelivery.add(s.email);
        deliveryEmails.push(s.email);
      }
    }
    if (deliveryEmails.length > MAX_DELIVERY) {
      return NextResponse.json({ error: `At most ${MAX_DELIVERY} delivery addresses per document` }, { status: 400 });
    }
  }

  // Operator-placed boxes (percent coords from the modal's preview): each signer's own
  // list of signature / initials / full-name / date fields, on whichever pages they drew
  // them. Optional — a signer without an entry keeps the auto-stacked signature+date pair;
  // the module clamps rects and page numbers again server-side.
  type PlacedRect = { pageX: number; pageY: number; width: number; height: number };
  type FieldKind = "signature" | "initials" | "name" | "date" | "text" | "number";
  type PlacedBox = PlacedRect & {
    kind: FieldKind;
    pageNumber: number;
    required?: boolean;
    label?: string;
    order?: number;
  };
  type PlacementEntry = { signerIndex: number; fields: PlacedBox[] };
  /** Ceilings, so a runaway client cannot ask Documenso for thousands of fields. */
  const MAX_FIELDS_PER_SIGNER = 200;
  const MAX_FIELD_LABEL = 120;
  const FIELD_KINDS: readonly FieldKind[] = ["signature", "initials", "name", "date", "text", "number"];
  /** Documenso only honours required:false on these two (its own optional-capable list) —
   *  a signature or a date is always required there, so `false` on one is dropped here
   *  rather than sent and silently ignored. */
  const OPTIONAL_CAPABLE: readonly FieldKind[] = ["text", "number"];
  const placements: PlacementEntry[] = [];
  if (kind === "multisig") {
    let pRaw: unknown = [];
    try {
      pRaw = JSON.parse(String(form.get("placements") ?? "[]"));
    } catch {
      return NextResponse.json({ error: "placements must be a JSON array" }, { status: 400 });
    }
    const rectOf = (v: unknown): PlacedRect | null => {
      const r = v as { pageX?: unknown; pageY?: unknown; width?: unknown; height?: unknown };
      const nums = [r?.pageX, r?.pageY, r?.width, r?.height].map(Number);
      if (nums.some((n) => !Number.isFinite(n))) return null;
      const [pageX, pageY, width, height] = nums;
      if (width <= 0 || height <= 0 || pageX < 0 || pageY < 0 || pageX > 100 || pageY > 100) return null;
      return { pageX, pageY, width, height };
    };
    const seenIdx = new Set<number>();
    for (const raw of Array.isArray(pRaw) ? pRaw : []) {
      const e = raw as { signerIndex?: unknown; fields?: unknown };
      const idx = Number(e?.signerIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= signers.length) continue;
      if (seenIdx.has(idx)) continue;
      const fields: PlacementEntry["fields"] = [];
      for (const fRaw of Array.isArray(e?.fields) ? e.fields : []) {
        const f = fRaw as {
          kind?: unknown;
          pageNumber?: unknown;
          required?: unknown;
          label?: unknown;
          order?: unknown;
        };
        const k = String(f?.kind) as FieldKind;
        const page = Number(f?.pageNumber);
        const rect = rectOf(fRaw);
        if (!FIELD_KINDS.includes(k)) continue;
        if (!Number.isInteger(page) || page < 1 || page > 5000) continue;
        if (!rect) continue;
        const optional = f?.required === false && OPTIONAL_CAPABLE.includes(k);
        const label = typeof f?.label === "string" ? f.label.trim().slice(0, MAX_FIELD_LABEL) : "";
        const order = Number(f?.order);
        fields.push({
          kind: k,
          pageNumber: page,
          ...rect,
          ...(optional ? { required: false } : {}),
          ...(label ? { label } : {}),
          ...(Number.isInteger(order) && order >= 0 && order < MAX_FIELDS_PER_SIGNER
            ? { order }
            : {}),
        });
        if (fields.length >= MAX_FIELDS_PER_SIGNER) break;
      }
      // A signer with nothing left to fill in could never finish signing, and a stalled
      // signer stalls the whole chain — so an empty list falls back to the auto-stack
      // rather than being sent as-is.
      if (!fields.length) continue;
      seenIdx.add(idx);
      placements.push({ signerIndex: idx, fields });
    }
  }

  // 1) Create the legal_documents row (Office origin).
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const doc = await createOfficeLegalDocument(db, { slug, title });
  if (!doc) return NextResponse.json({ error: "Could not create document row" }, { status: 500 });

  // Certificate preference + original page count (the strip keeps exactly these pages).
  const pageCount = await getPdfPageCount(pdf).catch(() => null);
  await setLegalDocumentCertPrefs(db, doc.id, includeCertificate, pageCount).catch(() => {});

  // ── multisig: document flow — Office emails each named signer their own link NOW ──
  if (kind === "multisig") {
    // The invitation, exactly as it will arrive. Built before the send so the same object
    // is both what we mail and what we store — the later signers in a sequential chain are
    // invited by the completion webhook, days later, and must read these same words.
    const invite = inviteTemplateFrom(title, {
      subject: emailSubject,
      heading: inviteHeading,
      message: note,
      buttonLabel: inviteButtonLabel,
      footer: inviteFooter,
      replyTo: emailReplyTo,
      ...(journey ? { journey } : {}),
    });
    let result;
    try {
      result = await createAndDistributeMultisigFromPdf(pdf, title, signers, {
        // Recorded on the document so Documenso's own remaining surfaces (its reminder,
        // its signing page) say what the signer was actually told — but it emails nobody.
        subject: invite.subject,
        message: invite.message,
        ...(emailReplyTo ? { emailReplyTo } : {}),
        sequential,
        selfDistribute: true,
        redirectUrl: SIGN_COMPLETE_URL,
        ...(placements.length ? { placements } : {}),
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Documenso multisig creation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }

    await markLegalDocumentMultisig(db, doc.id, result.documensoDocumentId);
    // The completion webhook reads this list and mails the signed PDF to exactly it.
    await setLegalDocumentDelivery(db, doc.id, deliveryEmails).catch(() => {});
    // Store the invitation BEFORE anything is mailed: it is also the flag that says we own
    // this chain, and the webhook must never advance a document it thinks Documenso runs.
    await setLegalDocumentInvite(db, doc.id, invite);

    const recipientByEmail = new Map(result.recipients.map((r) => [r.email, r.recipientId]));
    const signerInputs: InsertSignerInput[] = [];
    for (const [i, s] of signers.entries()) {
      const member = await getMemberByEmail(db, s.email).catch(() => null);
      signerInputs.push({
        signerEmail: s.email,
        signerName: s.name,
        signingOrder: i + 1,
        memberId: member?.id ?? null,
        documensoRecipientId: recipientByEmail.get(s.email) ?? null,
        // Everyone starts 'pending'. The roster has to exist before a single invitation
        // goes out — a signer could open their link and sign in the next second — and
        // 'sent' is then written per address, by the send that actually succeeded.
        status: "pending",
      });
    }
    await insertLegalDocumentSigners(db, doc.id, signerInputs);

    // Who gets invited now: everyone on a parallel document, only the first signer on a
    // sequential one (the completion webhook invites each next signer as their turn comes).
    const tokenByEmail = new Map(
      result.recipients.filter((r) => r.token).map((r) => [r.email, r.token as string]),
    );
    // Every token the document was created with, hashed onto its signer row — including the
    // ones nobody is mailed yet, since a sequential chain's later links already exist and are
    // valid. The hash is all that is kept; it is what lets each signer's own page name their
    // document and greet them instead of rendering an anonymous frame around a stranger's PDF.
    for (const [email, token] of tokenByEmail) {
      await rememberSigningToken(db, result.documensoDocumentId, email, token).catch(() => {});
    }
    // And what each of them was asked for, in the order they will meet it. The send just
    // resolved those boxes — the operator's placement or the auto-stacked default — and this
    // is the only moment they are known here, so the signer's page can say "2 of 5 filled"
    // instead of counting into the dark. Best-effort: a document still sends without it.
    for (const r of result.recipients) {
      if (!r.fieldPlan?.length) continue;
      await rememberSignerFieldPlan(db, result.documensoDocumentId, r.email, r.fieldPlan).catch(
        () => {},
      );
    }
    const byOrder = [...signers.entries()].sort(([a], [b]) => a - b);
    const inviteNow = sequential ? byOrder.slice(0, 1) : byOrder;
    const invited: string[] = [];
    const failed: string[] = [];
    for (const [, s] of inviteNow) {
      const token = tokenByEmail.get(s.email);
      if (!token) {
        failed.push(s.email);
        continue;
      }
      const rendered = renderSigningInvite({
        template: invite,
        url: signingUrl(token),
        signerName: s.name,
      });
      try {
        await sendMail({
          to: s.email,
          ...(s.name ? { toName: s.name } : {}),
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          ...(invite.replyTo ? { replyTo: invite.replyTo } : {}),
        });
      } catch {
        // The row stays 'pending' — but a mailer can fail AFTER the message left, so this
        // is reported, not retried. Re-inviting is the operator's call, never ours.
        failed.push(s.email);
        continue;
      }
      await markSignerSentByEmail(db, result.documensoDocumentId, s.email).catch(() => {});
      invited.push(s.email);
    }

    // Outbox rows so the Activity view shows each dispatch that actually happened.
    for (const s of signerInputs) {
      if (!invited.includes(s.signerEmail)) continue;
      await insertLegalSend(db, {
        legalDocumentId: doc.id,
        recipientEmail: s.signerEmail,
        recipientName: s.signerName ?? null,
        recipientMemberId: s.memberId ?? null,
        sentBy: auth.username,
        channel: "email",
        note: note || null,
        directToken: null,
      });
    }

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        version: doc.version,
        kind: "multisig",
        sendable: false,
        shareUrl: null,
        signerCount: signers.length,
        sequential,
        deliveryCount: deliveryEmails.length,
        invitedCount: invited.length,
        ...(failed.length ? { inviteFailed: failed } : {}),
      },
    });
  }

  // 2) Upload to Documenso → direct-link template (signature + auto-date field placed for us).
  let templateId: number;
  let token: string;
  try {
    ({ templateId, token } = await createDirectLinkTemplateFromPdf(pdf, title));
  } catch (err) {
    return NextResponse.json(
      { error: `Documenso template creation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // 3) Link the template + direct token back onto the row.
  const linked = await setDocumensoTemplate(db, doc.id, templateId, token);

  return NextResponse.json({
    ok: true,
    document: {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      version: doc.version,
      kind: "waiver",
      sendable: true,
      shareUrl: directLinkUrl(token),
    },
    _ok: Boolean(linked),
  });
}

// DELETE /api/esign/documents?id=<uuid> — soft-delete (deactivate) an Office document so it
// leaves the library, Send picker, and Documents gallery. Signed consent rows (legal_signatures)
// are preserved as an audit record — this hides the doc, it does not erase signatures.
//
// A multisig document also has to be retired at Documenso. Flipping `active` alone leaves the
// envelope PENDING there, and Documenso's own reminder sweep goes on mailing whoever has not
// signed, every two days, for as long as ninety days — a document the operator can no longer
// see, still chasing people (bug `esign-abandoned-envelope-keeps-reminding`).
// `retireMultisigDocument` silences the envelope before deleting it, refuses anything that is
// not DRAFT/PENDING (a COMPLETED envelope only soft-deletes there, which would hide the signed
// original), and never mails anyone. A Documenso failure must not fail the delete: our row is
// already retired, and the operator's next click cannot undo that — log it and carry on.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Missing or invalid document id" }, { status: 400 });
  }
  const removed = await deactivateOfficeLegalDocument(db, id);
  if (!removed) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  let envelopeRetired = false;
  if (removed.documensoDocumentId) {
    try {
      const outcome = await retireMultisigDocument(removed.documensoDocumentId);
      envelopeRetired = outcome.retired;
      if (!outcome.retired) {
        console.warn(
          `[esign] document ${id}: left Documenso envelope ${removed.documensoDocumentId} standing — ${outcome.reason}`,
        );
      }
    } catch (e) {
      console.error(
        `[esign] document ${id}: could not retire Documenso envelope ${removed.documensoDocumentId}`,
        e,
      );
    }
  }
  return NextResponse.json({ ok: true, id: removed.id, envelopeRetired });
}
