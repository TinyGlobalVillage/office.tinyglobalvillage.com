// src/app/dashboard/page.tsx

import { requireUser } from "@/auth/session";
import { logout } from "@/auth/logout";
import { count, desc } from "drizzle-orm";
import { officeDb, officeSchema } from "@/db/officeDB";

import {
  Page,
  Sidebar,
  Brand,
  BrandTitle,
  BrandSubtitle,
  NavSection,
  NavItem,
  Main,
  TopBar,
  HeadingGroup,
  Title,
  Subtitle,
  UserBadge,
  UserEmail,
  UserRole,
  Grid,
  Card,
  CardTitle,
  BigNumber,
  Placeholder,
  LogoutButton,
} from "./dashboard-styles";


export default async function DashboardPage() {
  const user = await requireUser();

  // --- KPI: team members ---
  const [{ value: usersCount }] = await officeDb
    .select({ value: count() })
    .from(officeSchema.officeUsers);

  // --- KPI: last action (if any) ---
  const lastLogs = await officeDb
    .select()
    .from(officeSchema.officeAuditLogs)
    .orderBy(desc(officeSchema.officeAuditLogs.createdAt))
    .limit(1);

  const lastLog = lastLogs[0];
  const lastActionLabel = lastLog
    ? `${lastLog.action} ${lastLog.target ? `on ${lastLog.target}` : ""}`
    : "No actions recorded yet";

  // Later we can pull real metrics from DB. For now, static placeholders.
  // const kpiUsers = "—";
  // const kpiSites = "—";
  // const kpiLastAction = "—";

  return (
    <Page>
      <Sidebar>
        <Brand>
          <BrandTitle>TGV Office</BrandTitle>
          <BrandSubtitle>Internal control panel</BrandSubtitle>
        </Brand>

        <NavSection>
          <NavItem $active>Overview</NavItem>
          <NavItem>Sites</NavItem>
          <NavItem>Billing</NavItem>
          <NavItem>Logs</NavItem>
        </NavSection>
      </Sidebar>

      <Main>
        <TopBar>
          <HeadingGroup>
            <Title>Overview</Title>
            <Subtitle>
              Welcome back, {user.name || user.email}. This will become your
              real-time view into TGV operations.
            </Subtitle>
          </HeadingGroup>

          <UserBadge>
            <UserEmail>{user.email}</UserEmail>
            <UserRole>{user.role}</UserRole>
            <form action={logout}>
              <LogoutButton type="submit">Log out</LogoutButton>
            </form>
          </UserBadge>
        </TopBar>

        <Grid>
          <Card>
            <CardTitle>Team members</CardTitle>
            <BigNumber>{usersCount}</BigNumber>
            <Placeholder>
              Total users in the Office system (owners, admins, staff).
            </Placeholder>
          </Card>

          <Card>
            <CardTitle>Managed sites</CardTitle>
            <BigNumber>—</BigNumber>
            <Placeholder>
              Later: number of live client sites with health status.
            </Placeholder>
          </Card>

          <Card>
            <CardTitle>Last action</CardTitle>
            <BigNumber>{lastLog ? "Recent" : "—"}</BigNumber>
            <Placeholder>{lastActionLabel}</Placeholder>
          </Card>
        </Grid>
      </Main>
    </Page>
  );
}
