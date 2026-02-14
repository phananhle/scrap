export interface PrimingResponse {
  text: string;
}

export interface JournalEntryDraft {
  primingText: string;
  photoUris: string[];
  videoUri: string | null;
}
