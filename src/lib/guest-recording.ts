export const GUEST_RECORDING_COUNT_KEY = "voise_guest_recording_count";

export function getGuestRecordingCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(GUEST_RECORDING_COUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function incrementGuestRecordingCount(): void {
  if (typeof window === "undefined") return;
  const next = getGuestRecordingCount() + 1;
  window.localStorage.setItem(GUEST_RECORDING_COUNT_KEY, String(next));
}

export const GUEST_FREE_LIMIT = 1;
