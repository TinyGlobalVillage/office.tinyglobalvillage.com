// src/app/dashboard/projects-actions.ts
"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { officeDb, officeSchema } from "@/db/officeDB";

type ProjectStatus = "current" | "new" | "pending_contract";

export async function createProject(formData: FormData) {
  const rawName = formData.get("name");
  const rawStatus = formData.get("status");
  const rawDeadline = formData.get("deadline");
  const rawDirectoryName = formData.get("directoryName");
  const rawNotes = formData.get("notes");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const status = (typeof rawStatus === "string"
    ? rawStatus.trim()
    : "new") as ProjectStatus;
  const deadlineStr =
    typeof rawDeadline === "string" ? rawDeadline.trim() : "";
  const directoryName =
    typeof rawDirectoryName === "string" ? rawDirectoryName.trim() : "";
  const notes =
    typeof rawNotes === "string" && rawNotes.trim()
      ? rawNotes.trim()
      : null;

  if (!name || !directoryName || !deadlineStr) {
    // later: surface real validation errors in UI
    return;
  }

  // Turn "YYYY-MM-DD" into a Date
  const deadline = new Date(`${deadlineStr}T00:00:00Z`);

  // Build full repo path under the hood
  const repoRoot = "/srv/refusion-core/client";
  const repoPath = `${repoRoot}/${directoryName}`;

  // Make sure the directory actually exists on the server
  try {
    const stat = await fs.stat(repoPath);
    if (!stat.isDirectory()) {
      // not a directory → bail
      return;
    }
  } catch {
    // directory does not exist → bail
    return;
  }

  // Build the VS Code URI (adjust "rcs-host" if your SSH host alias differs)
  const vscodeUri = `vscode://vscode-remote/ssh-remote+rcs-host${repoPath}`;

  await officeDb.insert(officeSchema.officeProjects).values({
    name,
    status,
    deadline,
    repoPath,
    vscodeUri,
    notes,
  });

  // Make sure the dashboard sees the new project
  revalidatePath("/dashboard");
}
