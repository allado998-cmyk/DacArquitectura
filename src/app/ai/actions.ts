"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { revokeConnection } from "@/lib/mcp/oauth-db";

export async function revokeConnectionAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("client_id") ?? "");
  if (!clientId) return;
  await revokeConnection(user, clientId);
  revalidatePath("/ai");
}
