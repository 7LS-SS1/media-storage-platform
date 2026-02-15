export const STORAGE_BUCKETS = ["media", "jav"] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]
export const DEFAULT_STORAGE_BUCKET: StorageBucket = "media"

export const parseStorageBucket = (value?: string | null): StorageBucket =>
  value === "jav" ? "jav" : DEFAULT_STORAGE_BUCKET

export const CONTENT_MODES = ["thai_clip", "av_movie"] as const
export type ContentMode = (typeof CONTENT_MODES)[number]

export const parseStorageBucketFilter = (value?: string | null): StorageBucket | null => {
  if (value === "media" || value === "jav") {
    return value
  }
  return null
}

export const parseContentMode = (value?: string | null): ContentMode | null => {
  if (value === "thai_clip" || value === "av_movie") {
    return value
  }
  return null
}

export const storageBucketFromContentMode = (value?: string | null): StorageBucket | null => {
  const mode = parseContentMode(value)
  if (!mode) {
    return null
  }
  return mode === "av_movie" ? "jav" : "media"
}

export const resolveStorageBucketFilter = (input: {
  storageBucket?: string | null
  bucket?: string | null
  type?: string | null
}): StorageBucket | null => {
  const explicitBucket = parseStorageBucketFilter(input.storageBucket ?? input.bucket)
  if (explicitBucket) {
    return explicitBucket
  }

  return storageBucketFromContentMode(input.type)
}
