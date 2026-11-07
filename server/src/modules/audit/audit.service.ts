import { ObjectId } from "mongodb";
import { collections } from "../../db/mongo.js";

export async function record(
  actorId: ObjectId | null,
  action: string,
  entity: string,
  entityId: ObjectId | null,
  data: Record<string, unknown> = {},
): Promise<void> {
  const col = await collections.auditLogs();
  await col.insertOne({ _id: new ObjectId(), actorId, action, entity, entityId, data, createdAt: new Date() });
}
