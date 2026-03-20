import type { ZodError } from "zod";

/** Extract the first human-readable error message from a Zod validation failure. */
export function zodMsg(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}
