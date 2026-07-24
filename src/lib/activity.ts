import "server-only";
import { prisma } from "./prisma";

type LogInput = {
  userId: string;
  action: string;
  details?: string;
  deviceId?: string;
  eventId?: string;
  lat?: number;
  lng?: number;
};

/** Aktion in der Historie protokollieren (wer, was, wann, ggf. wo). */
export async function logActivity(input: LogInput): Promise<void> {
  await prisma.activityLog.create({ data: input });
}
