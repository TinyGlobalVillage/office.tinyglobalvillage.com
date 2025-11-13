// src/app/dashboard/page.tsx

import { requireUser } from "@/auth/session";
import { logout } from "@/auth/logout";
import { count, desc, asc, eq } from "drizzle-orm";
import { officeDb, officeSchema } from "@/db/officeDB";
import { createProject } from "./projects-actions";

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

  const currentProjects = await officeDb
    .select()
    .from(officeSchema.officeProjects)
    .where(eq(officeSchema.officeProjects.status, "current"))
    .orderBy(asc(officeSchema.officeProjects.deadline));

  const newProjects = await officeDb
    .select()
    .from(officeSchema.officeProjects)
    .where(eq(officeSchema.officeProjects.status, "new"))
    .orderBy(asc(officeSchema.officeProjects.createdAt));

  const pendingProjects = await officeDb
    .select()
    .from(officeSchema.officeProjects)
    .where(eq(officeSchema.officeProjects.status, "pending_contract"))
    .orderBy(asc(officeSchema.officeProjects.createdAt));

  const lastLog = lastLogs[0];
  const lastActionLabel = lastLog
    ? `${lastLog.action} ${lastLog.target ? `on ${lastLog.target}` : ""}`
    : "No actions recorded yet";


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
                   <section style={{ gridColumn: "1 / -1", marginTop: "2rem" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
              Projects
            </h2>

            {/* Current Projects */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                  Current Projects
                </h3>
                {/* later: this can become the "+" button that opens a modal */}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  overflowX: "auto",
                  paddingBottom: "0.5rem",
                }}
              >
                {currentProjects.length === 0 && (
                  <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                    No current projects yet.
                  </div>
                )}

                {currentProjects.map((project) => (
                  <div
                    key={project.id}
                    style={{
                      minWidth: "220px",
                      maxWidth: "220px",
                      padding: "0.9rem",
                      borderRadius: "1rem",
                      border: "1px solid rgba(127, 90, 240, 0.5)",
                      background: "rgba(10, 10, 20, 0.9)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {project.name}
                    </div>

                    <div
                      style={{
                        fontSize: "0.8rem",
                        opacity: 0.7,
                      }}
                    >
                      Deadline:{" "}
                      {project.deadline
                        ? project.deadline.toISOString().slice(0, 10)
                        : "—"}
                    </div>

                    {project.notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          opacity: 0.75,
                          marginTop: "0.25rem",
                        }}
                      >
                        {project.notes}
                      </div>
                    )}

                    {project.vscodeUri && (
                      <a
                        href={project.vscodeUri}
                        style={{
                          marginTop: "0.5rem",
                          fontSize: "0.8rem",
                          color: "#7f5af0",
                          textDecoration: "underline",
                          alignSelf: "flex-start",
                        }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in VS Code
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* New Projects */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", opacity: 0.9 }}>New Projects</h3>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  overflowX: "auto",
                  paddingBottom: "0.5rem",
                }}
              >
                {newProjects.length === 0 && (
                  <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                    No new projects yet.
                  </div>
                )}

                {newProjects.map((project) => (
                  <div
                    key={project.id}
                    style={{
                      minWidth: "220px",
                      maxWidth: "220px",
                      padding: "0.9rem",
                      borderRadius: "1rem",
                      border: "1px solid rgba(44, 182, 125, 0.6)",
                      background: "rgba(10, 20, 10, 0.9)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {project.name}
                    </div>

                    <div
                      style={{
                        fontSize: "0.8rem",
                        opacity: 0.7,
                      }}
                    >
                      Created:{" "}
                      {project.createdAt
                        ? project.createdAt.toISOString().slice(0, 10)
                        : "—"}
                    </div>

                    {project.vscodeUri && (
                      <a
                        href={project.vscodeUri}
                        style={{
                          marginTop: "0.5rem",
                          fontSize: "0.8rem",
                          color: "#2cb67d",
                          textDecoration: "underline",
                          alignSelf: "flex-start",
                        }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in VS Code
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Project Contracts */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", opacity: 0.9 }}>
                  Pending Project Contracts
                </h3>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  overflowX: "auto",
                  paddingBottom: "0.5rem",
                }}
              >
                {pendingProjects.length === 0 && (
                  <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                    No pending contracts.
                  </div>
                )}

                {pendingProjects.map((project) => (
                  <div
                    key={project.id}
                    style={{
                      minWidth: "220px",
                      maxWidth: "220px",
                      padding: "0.9rem",
                      borderRadius: "1rem",
                      border: "1px solid rgba(255, 184, 77, 0.7)",
                      background: "rgba(25, 20, 5, 0.9)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {project.name}
                    </div>

                    <div
                      style={{
                        fontSize: "0.8rem",
                        opacity: 0.7,
                      }}
                    >
                      Created:{" "}
                      {project.createdAt
                        ? project.createdAt.toISOString().slice(0, 10)
                        : "—"}
                    </div>

                    {project.notes && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          opacity: 0.75,
                          marginTop: "0.25rem",
                        }}
                      >
                        {project.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Existing form for adding a project (we'll turn this into a "+" modal later) */}

            <form
              action={createProject}
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                borderRadius: "0.75rem",
                border: "1px solid rgba(255,255,255,0.1)",
                maxWidth: "480px",
              }}
            >
              <h3 style={{ marginBottom: "0.75rem" }}>Add existing project</h3>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="status"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue=""
                  required
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="" disabled>
                    Select status…
                  </option>
                  <option value="current">Current project</option>
                  <option value="new">New project</option>
                  <option value="pending_contract">Pending contract</option>
                </select>
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="name"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  Project name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="tinyglobalvillage.com"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="deadline"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  Deadline
                </label>
                <input
                  id="deadline"
                  name="deadline"
                  type="date"
                  required
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="directoryName"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  Directory name
                </label>
                <input
                  id="directoryName"
                  name="directoryName"
                  type="text"
                  required
                  placeholder="tinyglobalvillage.com"
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  htmlFor="notes"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  style={{ width: "100%", padding: "0.5rem" }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: "0.75rem",
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, #7f5af0, #2cb67d)",
                  color: "#050309",
                  fontWeight: "bold",
                }}
              >
                Add project
              </button>
            </form>
          </section>
        </Grid>
      </Main>
    </Page>
  );
}
