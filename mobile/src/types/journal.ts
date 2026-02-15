export interface PrimingResponse {
  text: string;
}

/** Request body for POST /poke/agent (aligned with backend). Client should send request_id so it can call the callback. */
export interface PokeSendBody {
  request_id?: string;
  message?: string;
  include_messages?: boolean;
  message_hours?: number;
  message_contact?: string;
}

/** Body for POST /poke/callback to deliver the agent reply and unblock the Mac. */
export interface PokeCallbackBody {
  request_id: string;
  message: string;
}

/** Poke API may return JSON with various shapes; we normalize to string for priming display. */
export type PokeSendResponse = string | Record<string, unknown>;

export interface JournalEntryDraft {
  primingText: string;
  photoUris: string[];
  videoUri: string | null;
}
