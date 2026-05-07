"use client";

// BackupGuide — operator's reference for the full RCS backup architecture.
// Persistent QMBM panel toggled from the modal header. Designed to be
// readable end-to-end so the operator can walk anyone through the system
// without context-switching to a doc site.

import styled from "styled-components";
import { colors, rgb } from "@/app/theme";

const Wrap = styled.section`
  display: flex; flex-direction: column; gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.75rem;
  background: linear-gradient(
    180deg,
    rgba(${rgb.gold}, 0.06) 0%,
    rgba(${rgb.gold}, 0.02) 100%
  );
  box-shadow: inset 0 0 30px rgba(${rgb.gold}, 0.04);
`;

const Title = styled.h2`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: ${colors.gold};
  text-shadow: 0 0 8px rgba(${rgb.gold}, 0.4);
  display: flex; align-items: center; gap: 0.5rem;
`;

const Lede = styled.p`
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--t-text);
  font-style: italic;
  border-left: 2px solid rgba(${rgb.gold}, 0.5);
  padding-left: 0.875rem;
`;

const H3 = styled.h3`
  margin: 0.25rem 0 -0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${colors.gold};
  display: flex; align-items: center; gap: 0.5rem;
  &::before {
    content: "";
    width: 0.4rem; height: 0.4rem; border-radius: 50%;
    background: ${colors.gold};
    box-shadow: 0 0 8px ${colors.gold};
  }
`;

const Para = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--t-text);
`;

const Group = styled.div`
  display: flex; flex-direction: column; gap: 0.6rem;
`;

const TierCard = styled.div<{ $accent?: "gold" | "soft" }>`
  padding: 0.75rem 0.875rem;
  border: 1px solid rgba(${rgb.gold}, ${(p) => p.$accent === "soft" ? 0.15 : 0.25});
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.025);
`;

const TierHead = styled.div`
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4rem 0.75rem;
  margin-bottom: 0.4rem;
`;

const TierName = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.04em;
`;

const TierMeta = styled.span`
  font-size: 0.7rem;
  color: var(--t-textGhost);
  font-family: ui-monospace, "SF Mono", monospace;
`;

const TierBody = styled.div`
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--t-text);
  & code {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 0.72rem;
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    background: rgba(${rgb.gold}, 0.1);
    color: ${colors.gold};
  }
`;

const Steps = styled.ol`
  margin: 0.4rem 0;
  padding: 0 0 0 1.2rem;
  display: flex; flex-direction: column; gap: 0.3rem;
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--t-text);

  & li::marker {
    color: ${colors.gold};
    font-weight: 700;
  }
  & code {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 0.72rem;
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
    background: rgba(${rgb.gold}, 0.1);
    color: ${colors.gold};
  }
`;

const TableShell = styled.div`
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.5rem;
  overflow: hidden;
  font-size: 0.75rem;
`;

const Tbl = styled.table`
  width: 100%;
  border-collapse: collapse;
  & th, & td {
    padding: 0.45rem 0.65rem;
    text-align: left;
    border-bottom: 1px solid rgba(${rgb.gold}, 0.1);
    line-height: 1.45;
  }
  & th {
    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${colors.gold};
    background: rgba(${rgb.gold}, 0.08);
  }
  & td {
    color: var(--t-text);
  }
  & tr:last-child td { border-bottom: none; }
  & code {
    font-family: ui-monospace, monospace; font-size: 0.7rem;
    color: ${colors.gold};
  }
`;

const Callout = styled.div<{ $kind?: "tip" | "warn" }>`
  display: flex; gap: 0.6rem; align-items: flex-start;
  padding: 0.65rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.78rem;
  line-height: 1.55;
  border: 1px solid ${(p) => p.$kind === "warn"
    ? `rgba(${rgb.red}, 0.3)`
    : `rgba(${rgb.gold}, 0.25)`};
  background: ${(p) => p.$kind === "warn"
    ? `rgba(${rgb.red}, 0.06)`
    : `rgba(${rgb.gold}, 0.04)`};
  color: var(--t-text);

  & > .glyph {
    flex-shrink: 0;
    color: ${(p) => p.$kind === "warn" ? colors.red : colors.gold};
    font-weight: 700;
  }
`;

const RecoveryGrid = styled.div`
  display: grid; gap: 0.6rem;
  grid-template-columns: 1fr;
  @media (min-width: 700px) { grid-template-columns: 1fr 1fr; }
`;

const Scenario = styled.div`
  padding: 0.65rem 0.85rem;
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.5rem;
  font-size: 0.78rem;
  line-height: 1.55;
  background: rgba(0,0,0,0.15);

  & .head {
    display: block;
    font-weight: 700; color: ${colors.gold};
    margin-bottom: 0.3rem;
    font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase;
  }
`;

export default function BackupGuide() {
  return (
    <Wrap>
      <Title>📖 RCS Backup Architecture · Operator&apos;s Guide</Title>

      <Lede>
        A cryptographically-encrypted, deduplicated off-site backup pipeline designed for sovereign infrastructure.
        Every irreplaceable byte on RCS snapshots nightly to a Swiss datacenter — encrypted client-side before it leaves
        the box, immutable on arrival, restorable to a fresh VPS in under two hours.
      </Lede>

      <Group>
        <H3>What gets backed up</H3>
        <Para>
          Four tiers, ordered by recovery cost. Tier 3 isn&apos;t handled here because GitHub already covers it.
        </Para>

        <TierCard>
          <TierHead>
            <TierName>Tier 1 · Irreplaceable</TierName>
            <TierMeta>nightly · 02:30 · 14d/8w/12m/forever-yearly</TierMeta>
          </TierHead>
          <TierBody>
            All Postgres dumps (<code>tgv_db</code>, <code>refusionist_db</code>, <code>giocoelho_db</code>),
            Office runtime JSON state (sessions, frontdesk, calls, announcements), shared <code>cdn/</code> assets,
            and per-tenant uploads as tenants onboard. This is what hurts to lose — every paying-customer
            relationship lives here.
          </TierBody>
        </TierCard>

        <TierCard>
          <TierHead>
            <TierName>Tier 2 · Costly to recreate</TierName>
            <TierMeta>weekly · Sun 03:30 · 4w/6m</TierMeta>
          </TierHead>
          <TierBody>
            <code>/etc/nginx</code>, <code>/etc/letsencrypt</code>, <code>/etc/livekit</code>, <code>/etc/freeswitch</code>,
            <code> ~/.pm2/dump.pm2</code>, <code>~/.claude</code>. Replaceable from templates if you have to,
            but a day of fiddling each.
          </TierBody>
        </TierCard>

        <TierCard>
          <TierHead>
            <TierName>Tier 4 · Secrets</TierName>
            <TierMeta>weekly · Sun 03:00 · 4w/6m · double-encrypted</TierMeta>
          </TierHead>
          <TierBody>
            Every <code>.env.local</code> across <code>clients/*</code> and <code>packages/@tgv/*</code>.
            GPG-encrypted <em>first</em> with the backup-escrow keypair (private key NEVER on RCS),
            then restic-encrypted on top. Two layers means even a full rsync.net breach can&apos;t read your secrets
            without the MacPass-stored private key.
          </TierBody>
        </TierCard>

        <TierCard $accent="soft">
          <TierHead>
            <TierName>Tier 3 · Already on GitHub</TierName>
            <TierMeta>not in this pipeline</TierMeta>
          </TierHead>
          <TierBody>
            All code, configs, package.json, ecosystem.config.cjs, skills repo, this entire frontend.
            Tracked in <code>github.com/TinyGlobalVillage/rcs</code> — re-clone on a fresh box and you&apos;re back.
          </TierBody>
        </TierCard>
      </Group>

      <Group>
        <H3>Where the data lives</H3>
        <RecoveryGrid>
          <Scenario>
            <span className="head">rsync.net Zurich · zh6502</span>
            Lifetime 1 TB plan ($480 once, never billed again). Family-owned since 2001.
            Weekly PGP-signed warrant canary. Swiss FADP jurisdiction. Hands-off &quot;Experts Only No Support&quot; tier — we don&apos;t need their support for restic.
          </Scenario>
          <Scenario>
            <span className="head">Your Mac · MacPass</span>
            restic password · GPG escrow private key · rsync.net SSH passphrase. <strong>This is the lockbox.</strong> Without MacPass nothing is restorable. With MacPass, full recovery on any new VPS.
          </Scenario>
          <Scenario>
            <span className="head">RCS · ephemeral</span>
            Staging dirs at <code>/srv/refusion-core/.backup-staging/</code> are wiped at the end of each run. No persistent backup data lives on RCS — by design.
          </Scenario>
          <Scenario>
            <span className="head">Office · runtime mirror</span>
            <code>data/backups/manifest.json</code> + <code>restore-test-history.json</code> + <code>config.json</code> — what this UI reads.
          </Scenario>
        </RecoveryGrid>
      </Group>

      <Group>
        <H3>What RCS does · nightly Tier 1</H3>
        <Steps>
          <li>Cron at 02:30 spawns <code>backup-tier1.sh</code></li>
          <li>Script reads <code>/srv/refusion-core/utils/backup-targets.yml</code> for the multi-tenant target list (DBs, paths, env globs — adding a tenant = adding a YAML entry, no code change)</li>
          <li>For each Postgres DB: <code>sudo -u postgres pg_dump --format=custom -d &lt;db&gt;</code> writes to a stable staging file (passwordless via <code>/etc/sudoers.d/rcs-backup</code>)</li>
          <li>Restic packages the dumps + paths into encrypted, content-addressable chunks (AES-256 + Poly1305)</li>
          <li>SFTP over the dedicated SSH key uploads only NEW chunks — deduplicated against prior snapshots, so a quiet night might upload &lt;1 MB</li>
          <li><code>restic forget --tag tier1 --prune</code> drops snapshots outside the retention window (live-tunable via the dial in this UI)</li>
          <li>Manifest entry written to <code>data/backups/manifest.json</code> — what the &quot;Recent Activity&quot; table here reads</li>
          <li>If anything fails, cron MAILTO emails <code>admin@tinyglobalvillage.com</code></li>
        </Steps>
      </Group>

      <Group>
        <H3>What RCS does · weekly Tier 4 (secrets)</H3>
        <Steps>
          <li>Cron at Sun 03:00 spawns <code>backup-tier4.sh</code></li>
          <li>Verifies the GPG escrow public key fingerprint matches expected (<code>562F31...3BB9</code>) — refuses to encrypt if drifted</li>
          <li><code>find</code> every <code>.env.local</code> across <code>clients/*</code> and <code>packages/@tgv/*</code></li>
          <li>For each: <code>gpg --encrypt --recipient admin@tinyglobalvillage.com</code> produces a <code>.gpg</code> blob</li>
          <li>Restic-encrypts the GPG blobs and uploads to rsync.net</li>
          <li>Original <code>.env.local</code> files NEVER leave RCS (only their double-encrypted blobs travel)</li>
        </Steps>
      </Group>

      <Group>
        <H3>What RCS does · monthly restore-test</H3>
        <Steps>
          <li>Cron at 1st of month 04:00 spawns <code>restore-test-postgres.sh</code></li>
          <li>Pulls the LATEST Tier 1 snapshot from rsync.net into a temp dir</li>
          <li>Spins up a Docker Postgres-16 container (throwaway, port-mapped to a random local port)</li>
          <li><code>pg_restore</code> the dump into a test database</li>
          <li>Sentinel query: <code>SELECT count(*) FROM pg_class</code> — must exceed 100 rows to PASS</li>
          <li>PASS → log to <code>restore-test-history.json</code> (the table in this UI)</li>
          <li>FAIL → email admin + future personal-alerts red-flag widget</li>
          <li>Tear down container + temp files</li>
        </Steps>
        <Callout>
          <span className="glyph">★</span>
          <div>
            <strong>This is what proves your backups are actually restorable.</strong> A backup you&apos;ve never tested
            isn&apos;t a backup; it&apos;s a comfort blanket. The monthly cron makes sure the comfort is real.
          </div>
        </Callout>
      </Group>

      <Group>
        <H3>Defense in depth · ransomware resistance</H3>
        <TableShell>
          <Tbl>
            <thead>
              <tr><th>Layer</th><th>Protects against</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>restic</code> AES-256 + Poly1305</td>
                <td>rsync.net or any intermediary reading your data</td>
              </tr>
              <tr>
                <td>GPG escrow second layer on <code>.env.local</code></td>
                <td>both rsync.net AND a compromised RCS reading secrets</td>
              </tr>
              <tr>
                <td>Dedicated SSH key</td>
                <td>shared-credential blast radius</td>
              </tr>
              <tr>
                <td>Stable staging paths</td>
                <td>retention grouping (so older snapshots actually prune)</td>
              </tr>
              <tr>
                <td>ZFS snapshots <em>(optional, configure in AM)</em></td>
                <td>server-side rollback even if all client credentials are stolen</td>
              </tr>
              <tr>
                <td>SSH <code>command=</code> restriction <em>(pending)</em></td>
                <td>stolen backup key can&apos;t run delete commands</td>
              </tr>
              <tr>
                <td>GC key off-RCS <em>(pending)</em></td>
                <td>pruning happens out-of-band from MacPass-stored credential</td>
              </tr>
            </tbody>
          </Tbl>
        </TableShell>
      </Group>

      <Group>
        <H3>The recovery story</H3>
        <RecoveryGrid>
          <Scenario>
            <span className="head">RCS dies, Mac survives</span>
            Recoverable. Provision Ubuntu 24.04 VPS · install restic + postgresql-16 · restore restic password from MacPass · <code>restic restore latest --target /restore-staging</code> · <code>pg_restore</code> the dumps · GPG-decrypt env files · drop /etc configs · <code>pm2 resurrect</code> · update Cloudflare DNS. Target: <strong>under 2 hours</strong> from fresh VPS to logged-in user.
          </Scenario>
          <Scenario>
            <span className="head">Mac dies, RCS survives</span>
            Operating but no recovery path. Buy a new Mac today. Restore MacPass from your offsite backup (iCloud / paper / Time Machine). Do not delay — if RCS now ALSO dies, you&apos;re unrecoverable.
          </Scenario>
          <Scenario>
            <span className="head">rsync.net dies (very unlikely)</span>
            Up to 30-day grace via their data-retention policy. Beyond that, you need a multi-target setup (R2 / B2 / NAS) — which Phase 4 of this workflow contemplates but hasn&apos;t built yet.
          </Scenario>
          <Scenario>
            <span className="head">Both Mac and RCS die same day</span>
            Worst case. Recovery hinges on whether you printed/escrowed MacPass off-site. Without that, encrypted backups on rsync.net are <em>permanently unreadable</em>. With it, recovery as &quot;Mac dies&quot; above plus a fresh VPS bootstrap.
          </Scenario>
        </RecoveryGrid>
      </Group>

      <Group>
        <H3>The franchise story</H3>
        <Para>
          This entire pipeline is designed to clone. When TGV licenses a franchise, the franchisee runs an Office Wizard
          that walks them through every step you and I did manually together — sign up at rsync.net, generate keys on
          their Mac, drop secrets, smoke-test, click the master toggle on. The modal you&apos;re looking at is the
          prototype: the wizard reuses this exact info-display pattern in setup mode, so a non-technical operator can
          stand up the same sovereign backup posture in roughly 20 minutes of guided clicks.
        </Para>
        <Para>
          See <code>tgv-franchise-rollout.md</code> Component G for the wizard architecture; this modal&apos;s
          <code> BackupsControlModal.tsx</code> is the read-side primitive it builds on.
        </Para>
      </Group>

      <Callout>
        <span className="glyph">✶</span>
        <div>
          <strong>The point.</strong> Sovereign infrastructure means owning your encryption keys, choosing your
          jurisdiction, and being able to rebuild from zero. This pipeline does all three for $480 once and roughly
          fifteen minutes per quarter of operator attention. Set it once, soak for a week, and it runs forever.
        </div>
      </Callout>
    </Wrap>
  );
}
