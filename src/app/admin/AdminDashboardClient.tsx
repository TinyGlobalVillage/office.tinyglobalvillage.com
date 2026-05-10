"use client";

import Link from "next/link";
import styled from "styled-components";

const Wrap = styled.div`
  min-height: 100vh;
  padding: clamp(24px, 4vw, 64px);
  background: var(--t-bg);
  color: var(--t-text);
  font-family: var(--font-geist-sans);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.2px;
  margin: 0;
`;

const BackLink = styled(Link)`
  font-size: 13px;
  color: var(--t-textMuted);
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--t-border);
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--t-surface);
    color: var(--t-text);
  }
`;

const Card = styled.div`
  padding: 24px;
  border-radius: 14px;
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  margin-bottom: 16px;
`;

const CardTitle = styled.h2`
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--t-text);
`;

const CardBody = styled.p`
  font-size: 13px;
  color: var(--t-textMuted);
  line-height: 1.55;
  margin: 0;
`;

const DevBadge = styled.span`
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(0, 228, 253, 0.12);
  color: #00e4fd;
  border: 1px solid rgba(0, 228, 253, 0.3);
  margin-left: 10px;
  vertical-align: middle;
`;

type Props = { adminUsername: string };

export default function AdminDashboardClient({ adminUsername }: Props) {
  return (
    <Wrap>
      <Header>
        <Title>
          Office Dashboard
          <DevBadge>admin</DevBadge>
        </Title>
        <BackLink href="/dashboard">← Back to app</BackLink>
      </Header>

      <Card>
        <CardTitle>Signed in as {adminUsername}</CardTitle>
        <CardBody>
          This scaffold is where the <code>@tgv/module-dashboards</code> Dashboard
          component will mount once its auth + data sources are wired for office&apos;s
          JSON-store shape. For now, use the DEV MODE drawer (left edge) to switch
          effective user — every API route and server component will see the
          impersonated identity.
        </CardBody>
      </Card>

      <Card>
        <CardTitle>DEV MODE drawer</CardTitle>
        <CardBody>
          Enable the drawer from{" "}
          <strong>Settings → Interface Controls → DEV MODE drawer</strong>. When
          on, a cyan &quot;DEV&quot; tab appears on the left edge of every page;
          tap it to switch user. Impersonation cookies are scoped to this browser.
        </CardBody>
      </Card>
    </Wrap>
  );
}
