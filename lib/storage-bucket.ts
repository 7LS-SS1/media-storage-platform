export const STORAGE_BUCKETS = ["media", "jav"] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]
export const DEFAULT_STORAGE_BUCKET: StorageBucket = "media"

export const parseStorageBucket = (value?: string | null): StorageBucket =>
  value === "jav" ? "jav" : DEFAULT_STORAGE_BUCKET
