import { unstable_rethrow } from "next/navigation";
import { EngineError } from "./requests";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string; code?: string; existingId?: string };

/** Run a mutation and turn engine errors into a result the UI can show. */
export async function attempt(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err); // let redirect() and notFound() through
    if (err instanceof EngineError) {
      return { ok: false, error: err.message, code: err.code, existingId: err.existingId };
    }
    console.error("[action] failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
