# Email deliverability — the DNS change (drafted 2026-08-13)

Why this exists: an e-sign invite to `giomcjr@yahoo.com` landed in Yahoo's **Spam**
folder. Nothing was wrong with the send — Fastmail accepted both copies (the 22:16
direct-link mail from Office's JMAP mailer and the 22:17 signing mail from Documenso's
SMTP) and no bounce ever came back. Yahoo filtered it on arrival.

The cause is an authentication gap that is **ours alone to close**:
`tinyglobalvillage.com` is the only sending domain in the fleet with **no DMARC record**.
Since February 2024 Yahoo and Gmail both treat a missing DMARC policy as a demerit, and
Yahoo is the stricter of the two — it spam-folders rather than rejects, which is exactly
what we saw (no NDR, no trace, mail in Spam).

## What the audit found

| Domain | SPF | DKIM (Fastmail fm1/2/3) | DMARC |
|---|---|---|---|
| tinyglobalvillage.com | `include:spf.messagingengine.com ?all` | present | **MISSING** |
| refusionist.com | `include:spf.messagingengine.com ?all` | present | `p=none` + Cloudflare rua |
| resonantweaver.com | `include:spf.messagingengine.com ?all` | present | `p=none` + Cloudflare rua |
| giocoelho.com | `include:spf.messagingengine.com ?all` | present | `p=none` + Cloudflare rua |

All four zones are on Cloudflare nameservers. The three that already have DMARC got it
from Cloudflare's **DMARC Management** toggle (that is where the
`…@dmarc-reports.cloudflare.net` address comes from) — TGV's zone was simply never
switched on.

Every sender for these domains authenticates through Fastmail, verified against the live
env on RCS: Office's JMAP mailer, Documenso (`smtp.fastmail.com:465`, From
`no-reply@tinyglobalvillage.com`), the tgv.com app, Stepcenter, the Fliring scene mailer,
and RW's own `RW_SMTP_*` login. There is no second sending service to account for, which
is what makes the SPF change below safe.

## The change

### 1. DMARC on tinyglobalvillage.com — the actual fix

Preferred: Cloudflare dashboard → `tinyglobalvillage.com` → **Email** → **DMARC
Management** → Enable. It writes the record and gives us aggregate reports in the same
place as the other three zones, so all four are managed identically.

Equivalent manual record, if we would rather own the string:

```
Type:  TXT
Name:  _dmarc
Value: v=DMARC1; p=none; sp=none; adkim=r; aspf=r; fo=1; rua=mailto:dmarc@tinyglobalvillage.com
TTL:   Auto
```

`p=none` monitors without changing how anyone treats our mail — nothing can break on day
one. `sp=none` keeps subdomains explicitly at the same policy so they never inherit a
stricter one by surprise during the ramp. `fo=1` asks for a failure report whenever
either SPF or DKIM fails, which is what makes the ramp below safe to walk.

If we take the manual route, `dmarc@tinyglobalvillage.com` needs to exist as a Fastmail
alias first — aggregate reports arrive as daily XML attachments and a bouncing rua
address is itself a small negative signal.

### 2. Tighten SPF from neutral to softfail — all four zones

```
Type:  TXT
Name:  @
Value: v=spf1 include:spf.messagingengine.com ~all
```

`?all` (neutral) says "we have no opinion about mail from anywhere else", which reads to a
receiver as no policy at all. `~all` (softfail) says "anything not from Fastmail is
probably forged". Since every one of our senders is Fastmail, this costs us nothing and
turns a shrug into a statement. Stopping at `~all` rather than `-all` is deliberate:
hard-fail breaks mailing-list and forwarding paths, and DMARC gives us the enforcement we
actually want.

Apply to `tinyglobalvillage.com` first, then the other three — they have the same gap.

### 3. The ramp (after two weeks of clean reports)

Do not skip straight to enforcement. Read the aggregate reports first, confirm every
legitimate source is passing DKIM, then move the policy one rung at a time, leaving at
least two weeks between rungs:

`p=none` → `p=quarantine; pct=25` → `p=quarantine` → `p=reject`

Enforcement is where the deliverability gain compounds — and where a forgotten sender
would start silently failing, which is exactly why the reports come first.

## What this does not fix

DNS raises the floor; it does not retroactively clear a spam-folder verdict. Yahoo weighs
per-recipient engagement heavily, so marking the message **Not Spam** (done — it was found
in Yahoo's spam folder) and adding the sender to contacts moves that mailbox faster than
any record will.

Two smaller items worth queuing separately, neither blocking:

- Our e-sign invites send from `no-reply@` with no `Reply-To`. A reply-able address is a
  mild positive signal and a better recipient experience. Office's gear panel already
  exposes a Reply-To field — using it is free.
- Bulk or journey mail (not transactional e-sign) should carry `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers. Gmail and Yahoo both require one-click unsubscribe from
  bulk senders; transactional signing requests are exempt.

## Verify after applying

```bash
dig +short TXT _dmarc.tinyglobalvillage.com
dig +short TXT tinyglobalvillage.com | grep -i spf
```

Then send one test to a Gmail address and check the received headers show
`dkim=pass`, `spf=pass` and `dmarc=pass` with the domain aligned to
`tinyglobalvillage.com`.
