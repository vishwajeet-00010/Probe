import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { mutate } from "@/lib/database";
import { commandSchema } from "@/lib/validation";
import { applyCommand } from "@/services/commands";
import { failure, jsonBody, rateLimit, sameOrigin } from "@/lib/http";
import type { Collection } from "@/types/domain";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await getActor();
    rateLimit(`${actor.organizationId}:${actor.uid}`);
    const command = commandSchema.parse(await jsonBody(req));
    const requested: { collection: Collection; id: string }[] = [];
    const collectionForAction: Record<string, Collection> = {
      entry: "entries",
      equipment: "equipment",
      issue: "issues",
      team: "memberships",
      template: "templates",
      notification: "notifications",
      limits: "equipment",
    };
    if ("id" in command && command.id) {
      const collection = collectionForAction[command.action.split(".")[0]];
      if (collection) requested.push({ collection, id: command.id });
    }
    if (command.action === "entry.create") {
      if (command.equipmentId)
        requested.push({ collection: "equipment", id: command.equipmentId });
      if (command.dueItemId)
        requested.push({ collection: "dueItems", id: command.dueItemId });
      if (command.templateVersionId)
        requested.push({
          collection: "templateVersions",
          id: command.templateVersionId,
        });
    }
    const result = await mutate(
      actor,
      (s) => applyCommand(s, actor, command),
      requested,
    );
    return NextResponse.json(result);
  } catch (e) {
    return failure(e);
  }
}
