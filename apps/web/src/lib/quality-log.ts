import { diag } from "./diag";

const TAG = "quality";

export function logQuality(
  event:
    | "form_open"
    | "step_change"
    | "score_change"
    | "debrief_auto_fill"
    | "save_create"
    | "save_update"
    | "save_renote"
    | "save_error"
    | "seed_test"
    | "purge_test",
  data?: Record<string, unknown>,
) {
  diag.info(TAG, event, data);
}

export function logQualityError(event: string, err: unknown, data?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  diag.error(TAG, event, { ...data, message });
}
