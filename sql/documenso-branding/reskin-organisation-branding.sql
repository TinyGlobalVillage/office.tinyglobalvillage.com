-- reskin-organisation-branding.sql — the signer never meets Documenso (2026-08-14).
--
-- Gio's ruling: "take the invite over entirely, Documenso re-skinned". The first half lives
-- in code — Office writes and mails the invitation itself and distributes with NONE, so
-- Documenso sends nothing. This file is the second half: the page the signer lands on.
--
-- What the signing page does with these columns (read out of the running build,
-- document-signing-page-view-v2): the header renders Documenso's own logo UNLESS
-- brandingEnabled AND brandingLogo are both set, in which case it renders
--   <img src="/api/branding/logo/organisation/{orgId}">
-- brandingLogo is NOT a URL and NOT a data URI — it is the JSON descriptor `putFile()`
-- returns, `{"type","data"}`, and the route JSON.parses it (a data URI in that column makes
-- the route 500 with "Unexpected token 'd'"). With NEXT_PUBLIC_UPLOAD_TRANSPORT=database —
-- our setting — putFile stores the bytes inline, so the descriptor is
--   {"type":"BYTES_64","data":"<base64 of the file>"}
-- brandingColors is validated against ZCssVarsSchema and becomes the page's CSS custom
-- properties; any key it can't parse as a colour falls back to Documenso's default, so a
-- typo degrades quietly rather than breaking the page.
--
-- "Powered by Documenso" in the signing footer is NOT one of these columns — it is the
-- organisation's `hidePoweredBy` subscription claim (OrganisationClaim.flags), which on a
-- self-hosted instance is ours to set. TGV's org already carries it; this sets it on the
-- rest so no path can surface it.
--
-- SCOPE: every OrganisationGlobalSettings row on the instance. Our envelopes all belong to
-- the "Tiny Global Village" org (team "TGV Staff"), but the three Personal Organisation rows
-- are ours too, and a document created under one of them would otherwise wear Documenso's
-- identity. There is no third party on this instance.
--
-- COLOURS: deliberately the same restrained near-black-on-white as the invitation email
-- (module-documenso/server/invite.ts) — the signer's journey is one identity from inbox to
-- signature, and a legal surface is the wrong place for the console's neon.
--
-- Idempotent — re-running sets the same values. Apply from the office client dir on RCS:
--   cd /srv/refusion-core/clients/office.tinyglobalvillage.com
--   psql "$DOCUMENSO_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/documenso-branding/reskin-organisation-branding.sql
-- (the URL is the documenso container's NEXT_PRIVATE_DATABASE_URL)

\set logo `cat sql/documenso-branding/tgv-logo-96.b64`

BEGIN;

UPDATE "OrganisationGlobalSettings"
SET "brandingEnabled"        = true,
    "brandingLogo"           = jsonb_build_object('type', 'BYTES_64', 'data', :'logo')::text,
    "brandingUrl"            = 'https://tinyglobalvillage.com',
    "brandingCompanyDetails" = E'Tiny Global Village\ntinyglobalvillage.com',
    -- Kills "{sender} has invited you to sign …" in anything Documenso still renders.
    "includeSenderDetails"   = false,
    "brandingColors"         = jsonb_build_object(
      'background',           '#f4f5f7',
      'foreground',           '#14161a',
      'muted',                '#eceef1',
      'mutedForeground',      '#7b8494',
      'popover',              '#ffffff',
      'popoverForeground',    '#14161a',
      'card',                 '#ffffff',
      'cardBorder',           '#e3e5e9',
      'cardForeground',       '#14161a',
      'fieldCard',            '#ffffff',
      'fieldCardBorder',      '#d8dbe0',
      'fieldCardForeground',  '#14161a',
      'widget',               '#ffffff',
      'widgetForeground',     '#14161a',
      'border',               '#e3e5e9',
      'input',                '#d8dbe0',
      'primary',              '#14161a',
      'primaryForeground',    '#ffffff',
      'secondary',            '#eceef1',
      'secondaryForeground',  '#2c2f36',
      'accent',               '#eceef1',
      'accentForeground',     '#14161a',
      'destructive',          '#d64545',
      'destructiveForeground','#ffffff',
      'warning',              '#b7791f',
      'ring',                 '#14161a',
      'radius',               '8px'
    );

-- The signing footer's "Powered by" is a claim flag, not a settings column. The embed flags
-- sit beside it in the same jsonb (packages/lib/types/subscription.js names them): they open
-- /embed/sign/{token} — Documenso's own signing widget, hosted inside OUR page — and drop the
-- remaining Documenso identity from it. Upstream these are paid-plan claims; on a self-hosted
-- instance with billing off they are ours to grant, and several gates read
-- `!IS_BILLING_ENABLED() || flag`, so setting them explicitly only makes the intent legible.
UPDATE "OrganisationClaim"
SET flags = COALESCE(flags, '{}'::jsonb) || '{
  "hidePoweredBy": true,
  "allowCustomBranding": true,
  "embedSigning": true,
  "embedSigningWhiteLabel": true
}'::jsonb;

COMMIT;

-- Verify (logo shown as a length so the blob stays out of the terminal):
--   SELECT g.id, o.name, g."brandingEnabled", length(g."brandingLogo") AS logolen,
--          g."includeSenderDetails", g."brandingColors"->>'primary' AS primary
--     FROM "OrganisationGlobalSettings" g
--     LEFT JOIN "Organisation" o ON o."organisationGlobalSettingsId" = g.id;
