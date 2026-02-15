export interface PrimingResponse {
  text: string;
}

/** GET /summarize response (gcal + gemini). */
export interface SummarizeResponse {
  ok: boolean;
  summary?: string;
  error?: string;
}

export interface JournalEntryDraft {
  primingText: string;
  photoUris: string[];
  videoUri: string | null;
}
