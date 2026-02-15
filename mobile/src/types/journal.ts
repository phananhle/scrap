export interface PrimingResponse {
  text: string;
}

/** Request body for POST /poke/send (aligned with backend). */
export interface PokeSendBody {
  message?: string;
  include_messages?: boolean;
  message_hours?: number;
  message_contact?: string;
}

/** Poke API may return JSON with various shapes; we normalize to string for priming display. */
export type PokeSendResponse = string | Record<string, unknown>;

export interface JournalEntryDraft {
  primingText: string;
  photoUris: string[];
  videoUri: string | null;
}
