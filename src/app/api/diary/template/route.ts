import { NextResponse } from "next/server";
import { readTemplate } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const content = await readTemplate();
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
