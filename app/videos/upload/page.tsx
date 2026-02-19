"use client"

import { useEffect, useMemo, useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Check,
  Film,
  Image as ImageIcon,
  FileVideo,
  Info,
  Sparkles,
  Tag,
  Users,
  FolderOpen,
  Eye,
  Calendar,
  Building2,
  Hash,
  ChevronRight,
  Play,
  Loader2,
  BarChart2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ActorSelect } from "@/components/actor-select"
import { StudioSelect } from "@/components/studio-select"
import { AV_GENRES } from "@/lib/av-genres"
import { STANDARD_TAGS } from "@/lib/standard-tags"
import { TAG_LIMIT } from "@/lib/tag-constraints"
import { SEO_PASS_SCORE } from "@/lib/video-seo"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string
  name: string
}

interface Domain {
  id: string
  domain: string
  isActive: boolean
}

interface SeoCheck {
  key: string
  label: string
  passed: boolean
  message: string
  suggestion: string
  weight: number
  earned: number
  isCritical: boolean
}

type Visibility = "PUBLIC" | "PRIVATE" | "DOMAIN_RESTRICTED"
type StorageBucket = "media" | "jav"
type SeoStatus = "idle" | "running" | "done"

// ─── Steps ───────────────────────────────────────────────────────────────────

const steps = [
  { id: 1, title: "ประเภท & ไฟล์", icon: FileVideo },
  { id: 2, title: "ข้อมูลวิดีโอ", icon: Info },
  { id: 3, title: "หมวดหมู่ & แท็ก", icon: Tag },
  { id: 4, title: "ตรวจ SEO", icon: BarChart2 },
  { id: 5, title: "ตรวจสอบ & อัปโหลด", icon: Check },
]

// ─── Page Component ───────────────────────────────────────────────────────────

export default function UploadVideoPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)

  // ── Form State ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("")
  const [targetKeyword, setTargetKeyword] = useState("")
  const [description, setDescription] = useState("")
  const [actors, setActors] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC")
  const [storageBucket, setStorageBucket] = useState<StorageBucket>("media")
  const [allowedDomainIds, setAllowedDomainIds] = useState<string[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [movieCode, setMovieCode] = useState("")
  const [studio, setStudio] = useState("")
  const [releaseDate, setReleaseDate] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [enableNewCategory, setEnableNewCategory] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagError, setTagError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [isDraggingThumb, setIsDraggingThumb] = useState(false)

  // ── SEO State ───────────────────────────────────────────────────────────────
  const [seoStatus, setSeoStatus] = useState<SeoStatus>("idle")
  const [seoProgress, setSeoProgress] = useState(0)
  const [seoScore, setSeoScore] = useState<number | null>(null)
  const [seoPassed, setSeoPassed] = useState<boolean | null>(null)
  const [seoChecks, setSeoChecks] = useState<SeoCheck[]>([])
  const [seoRecommendations, setSeoRecommendations] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Track form data fingerprint used for last SEO run so we can show "stale" warning
  const lastSeoFingerprint = useRef<string | null>(null)

  const currentFingerprint = `${title}||${targetKeyword}||${description}||${tags.join(",")}||${!!thumbnailFile}`
  const seoIsStale =
    seoStatus === "done" &&
    lastSeoFingerprint.current !== null &&
    lastSeoFingerprint.current !== currentFingerprint

  // ── Derived ─────────────────────────────────────────────────────────────────
  const normalizedTags = useMemo(() => new Set(tags.map((tag) => tag.toLowerCase())), [tags])
  const isAv = storageBucket === "jav"
  const tagOptions = isAv ? AV_GENRES : STANDARD_TAGS
  const tagLabel = isAv ? "ประเภทหนัง" : "แท็ก"
  const tagPlaceholder = isAv ? "พิมพ์ประเภทหนังแล้วกด Enter" : "พิมพ์แท็กแล้วกด Enter"
  const tagLimitMessage = `เพิ่มแท็กได้สูงสุด ${TAG_LIMIT} รายการ`

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const slugify = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "")

  const normalizeVideoContentType = (file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith(".ts")) return "video/mp2t"
    if (name.endsWith(".m2ts")) return "video/mp2t"
    if (file.type.toLowerCase() === "video/ts") return "video/mp2t"
    return file.type
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // ── File Handlers ────────────────────────────────────────────────────────────
  const handleVideoSelect = useCallback(
    (file: File | null) => {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
      setVideoFile(file)
      if (file) {
        setVideoPreview(URL.createObjectURL(file))
        if (errors.videoFile) {
          setErrors((current) => {
            const { videoFile, ...rest } = current
            return rest
          })
        }
      } else {
        setVideoPreview(null)
      }
    },
    [videoPreview, errors.videoFile],
  )

  const handleThumbnailSelect = useCallback(
    (file: File | null) => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview)
      setThumbnailFile(file)
      if (file) {
        setThumbnailPreview(URL.createObjectURL(file))
      } else {
        setThumbnailPreview(null)
      }
    },
    [thumbnailPreview],
  )

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent, setDragging: (v: boolean) => void) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent, setDragging: (v: boolean) => void) => {
    e.preventDefault()
    setDragging(false)
  }

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingVideo(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("video/")) handleVideoSelect(file)
  }

  const handleThumbDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingThumb(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) handleThumbnailSelect(file)
  }

  // ── Tag Management ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tagError && tags.length < TAG_LIMIT) setTagError(null)
  }, [tagError, tags.length])

  const addTags = (value: string) => {
    const nextTags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (nextTags.length === 0) return
    let hitLimit = false
    setTags((current) => {
      const seen = new Set(current.map((tag) => tag.toLowerCase()))
      const merged = [...current]
      for (const tag of nextTags) {
        const key = tag.toLowerCase()
        if (seen.has(key)) continue
        if (merged.length >= TAG_LIMIT) {
          hitLimit = true
          break
        }
        seen.add(key)
        merged.push(tag)
      }
      return merged
    })
    if (hitLimit) setTagError(tagLimitMessage)
    else setTagError(null)
  }

  const handleAddTag = () => {
    if (!tagInput.trim()) return
    addTags(tagInput)
    setTagInput("")
  }

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleAddTag()
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove))
  }

  const toggleTagOption = (tag: string) => {
    let hitLimit = false
    setTags((current) => {
      const key = tag.toLowerCase()
      const exists = current.some((value) => value.toLowerCase() === key)
      if (exists) return current.filter((value) => value.toLowerCase() !== key)
      if (current.length >= TAG_LIMIT) {
        hitLimit = true
        return current
      }
      return [...current, tag]
    })
    if (hitLimit) setTagError(tagLimitMessage)
    else setTagError(null)
  }

  // ── Category Management ──────────────────────────────────────────────────────
  const handleToggleNewCategory = (checked: boolean) => {
    setEnableNewCategory(checked)
    if (!checked) {
      setNewCategoryName("")
      setCategoryError(null)
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      setCategoryError("กรุณากรอกชื่อหมวดหมู่")
      return
    }
    setCreatingCategory(true)
    setCategoryError(null)
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug: slugify(name) || name }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create category")
      setCategories((current) => {
        const next = [...current, data.category]
        next.sort((a, b) => a.name.localeCompare(b.name))
        return next
      })
      setCategoryIds((current) =>
        current.includes(data.category.id) ? current : [...current, data.category.id],
      )
      setNewCategoryName("")
      toast.success("เพิ่มหมวดหมู่สำเร็จ")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create category"
      setCategoryError(message)
      toast.error(message)
    } finally {
      setCreatingCategory(false)
    }
  }

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/categories")
        if (response.ok) {
          const data = await response.json()
          setCategories(data.categories)
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (visibility !== "DOMAIN_RESTRICTED") {
      setAllowedDomainIds([])
      return
    }
    async function fetchDomains() {
      try {
        const response = await fetch("/api/domains", { credentials: "include" })
        if (response.ok) {
          const data = await response.json()
          setDomains(data.domains)
        } else if (response.status === 403) {
          toast.error("Only admins can manage domain restrictions.")
        }
      } catch (error) {
        console.error("Failed to fetch domains:", error)
      }
    }
    fetchDomains()
  }, [visibility])

  const activeDomains = useMemo(() => domains.filter((domain) => domain.isActive), [domains])

  const toggleDomain = (domainId: string) => {
    setAllowedDomainIds((current) =>
      current.includes(domainId) ? current.filter((id) => id !== domainId) : [...current, domainId],
    )
  }

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
    )
  }

  // ── SEO: Run Analysis (streaming) ────────────────────────────────────────────
  const handleRunSeo = useCallback(
    async (overrides?: { title?: string; targetKeyword?: string; description?: string; tags?: string[] }) => {
      const seoTitle = overrides?.title ?? title
      const seoTargetKeyword = overrides?.targetKeyword ?? targetKeyword
      const seoDesc = overrides?.description ?? description
      const seoTags = overrides?.tags ?? tags

      setSeoStatus("running")
      setSeoProgress(0)
      setSeoChecks([])
      setSeoScore(null)
      setSeoPassed(null)
      setSeoRecommendations([])

      try {
        const response = await fetch("/api/seo/videos/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: seoTitle,
            targetKeyword: seoTargetKeyword,
            description: seoDesc || undefined,
            tags: seoTags,
            hasThumbnail: !!thumbnailFile,
            movieCode: movieCode || undefined,
            studio: studio || undefined,
            storageBucket,
            actors,
          }),
        })

        if (!response.ok) throw new Error("SEO analysis failed")

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const event = JSON.parse(line)
              if (event.type === "check") {
                setSeoChecks((prev) => [...prev, event.check as SeoCheck])
                setSeoProgress(event.progress as number)
              } else if (event.type === "result") {
                setSeoScore(event.score as number)
                setSeoPassed(event.passed as boolean)
                setSeoRecommendations(event.recommendations as string[])
                setSeoProgress(100)
                setSeoStatus("done")
                lastSeoFingerprint.current = `${seoTitle}||${seoTargetKeyword}||${seoDesc}||${seoTags.join(",")}||${!!thumbnailFile}`
              }
            } catch {
              // malformed line — skip
            }
          }
        }
      } catch (error) {
        setSeoStatus("idle")
        toast.error("เกิดข้อผิดพลาดในการตรวจ SEO กรุณาลองใหม่")
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, targetKeyword, description, tags, thumbnailFile, movieCode, studio, storageBucket, actors],
  )

  // ── SEO: Generate Improvements ────────────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/seo/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          targetKeyword,
          description: description || undefined,
          tags,
          hasThumbnail: !!thumbnailFile,
          movieCode: movieCode || undefined,
          studio: studio || undefined,
          storageBucket,
          actors,
        }),
      })

      if (!response.ok) throw new Error("Generate failed")

      const result = await response.json()
      setTitle(result.title as string)
      setDescription(result.description as string)
      setTags(result.tags as string[])
      toast.success(`สร้างข้อมูล SEO ใหม่แล้ว (คาดคะแนน ${result.expectedScore}/100) — กำลังตรวจซ้ำ…`)

      // Auto-rerun SEO with new values (pass directly to avoid stale closure)
      await handleRunSeo({
        title: result.title as string,
        targetKeyword,
        description: result.description as string,
        tags: result.tags as string[],
      })
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการสร้างข้อมูล SEO")
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Upload Helpers ────────────────────────────────────────────────────────────
  const MULTIPART_FORCE_THRESHOLD = 1 * 1024 * 1024 * 1024

  const normalizeErrorText = (value: string) => value.replace(/\s+/g, " ").trim()

  const truncateMessage = (value: string, max = 180) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value

  const extractStatusCode = (message: string) => {
    const match = message.match(/status\s*(\d+)/i)
    if (!match) return null
    const code = Number(match[1])
    return Number.isFinite(code) ? code : null
  }

  const buildXhrErrorMessage = (xhr: XMLHttpRequest, fallback: string) => {
    if (xhr.status === 0) return `${fallback}: การเชื่อมต่อถูกบล็อก (CORS) หรือเน็ตหลุด`
    const responseText = normalizeErrorText(xhr.responseText || "")
    if (responseText) return `${fallback} (status ${xhr.status}): ${truncateMessage(responseText)}`
    return `${fallback} (status ${xhr.status})`
  }

  const formatUploadError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : ""
    const message = normalizeErrorText(raw)
    if (!message) return "อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
    if (message.includes("Missing R2 configuration")) {
      const missing = message.split(":").slice(1).join(":").trim()
      return `ตั้งค่า R2 ไม่ครบ${missing ? ` (${missing})` : ""}`
    }
    if (message.includes("Invalid file type")) return `ชนิดไฟล์ไม่รองรับ: ${truncateMessage(message)}`
    if (message.includes("File too large")) return `ไฟล์ใหญ่เกินกำหนด: ${truncateMessage(message)}`
    if (message.includes("Unauthorized")) return "เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ"
    if (message.includes("Forbidden")) return "สิทธิ์ไม่เพียงพอสำหรับการอัปโหลด"
    if (message.toLowerCase().includes("etag")) return "อัปโหลดไม่สำเร็จ: ไม่พบ ETag จาก R2"
    const statusCode = extractStatusCode(message)
    if (statusCode === 0) return "อัปโหลดไม่สำเร็จ: ถูกบล็อกโดย CORS หรือเน็ตหลุด"
    if (statusCode === 403) return "อัปโหลดไม่สำเร็จ: ลิงก์อัปโหลดหมดอายุหรือสิทธิ์ไม่ถูกต้อง (403)"
    if (statusCode === 413) return "อัปโหลดไม่สำเร็จ: ไฟล์ใหญ่เกินข้อจำกัดของเซิร์ฟเวอร์ (413)"
    if (statusCode === 429) return "อัปโหลดไม่สำเร็จ: คำขอมากเกินไป กรุณารอสักครู่ (429)"
    return truncateMessage(message)
  }

  const uploadPart = (uploadUrl: string, blob: Blob, onPartProgress: (loaded: number) => void) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", uploadUrl)
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        onPartProgress(event.loaded)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag")
          if (!etag) {
            reject(new Error("Missing ETag from upload response"))
            return
          }
          resolve(etag.replace(/"/g, ""))
        } else {
          reject(new Error(buildXhrErrorMessage(xhr, "อัปโหลดส่วนย่อยไม่สำเร็จ")))
        }
      }
      xhr.onerror = () => reject(new Error(buildXhrErrorMessage(xhr, "อัปโหลดส่วนย่อยไม่สำเร็จ")))
      xhr.send(blob)
    })

  const uploadMultipartFile = async (
    file: File,
    uploadInfo: { uploadId: string; key: string; partSize: number; publicUrl: string; contentType: string },
    onProgress: (progress: number) => void,
    bucket: StorageBucket,
  ) => {
    const totalParts = Math.ceil(file.size / uploadInfo.partSize)
    const parts: Array<{ ETag: string; PartNumber: number }> = []
    let uploadedBytes = 0

    try {
      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        const start = (partNumber - 1) * uploadInfo.partSize
        const end = Math.min(start + uploadInfo.partSize, file.size)
        const blob = file.slice(start, end)

        const partResponse = await fetch("/api/upload-multipart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "part",
            key: uploadInfo.key,
            uploadId: uploadInfo.uploadId,
            partNumber,
            storageBucket: bucket,
          }),
        })
        const partInfo = await partResponse.json()
        if (!partResponse.ok) throw new Error(partInfo.error || "Failed to prepare upload part")

        const etag = await uploadPart(partInfo.uploadUrl, blob, (loaded) => {
          const totalLoaded = uploadedBytes + loaded
          onProgress(Math.round((totalLoaded / file.size) * 100))
        })

        uploadedBytes += blob.size
        parts.push({ ETag: etag, PartNumber: partNumber })
        onProgress(Math.round((uploadedBytes / file.size) * 100))
      }

      const completeResponse = await fetch("/api/upload-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "complete",
          key: uploadInfo.key,
          uploadId: uploadInfo.uploadId,
          parts,
          storageBucket: bucket,
        }),
      })
      const completeInfo = await completeResponse.json().catch(() => ({}))
      if (!completeResponse.ok) throw new Error(completeInfo.error || "Failed to complete upload")

      onProgress(100)
      return { url: uploadInfo.publicUrl, size: file.size, type: uploadInfo.contentType }
    } catch (error) {
      await fetch("/api/upload-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "abort",
          key: uploadInfo.key,
          uploadId: uploadInfo.uploadId,
          storageBucket: bucket,
        }),
      }).catch(() => null)
      throw error
    }
  }

  const uploadFile = async (
    file: File,
    type: "video" | "thumbnail",
    onProgress: (progress: number) => void,
    bucket: StorageBucket,
  ) => {
    const contentType = type === "video" ? normalizeVideoContentType(file) : file.type
    const shouldForceMultipart = type === "video" && file.size >= MULTIPART_FORCE_THRESHOLD

    const requestUploadInfo = async (forceMultipart: boolean) => {
      const uploadResponse = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentType,
          size: file.size,
          type,
          storageBucket: bucket,
          forceMultipart: forceMultipart || shouldForceMultipart,
        }),
      })
      const uploadInfo = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) {
        const issue =
          Array.isArray(uploadInfo.issues) && uploadInfo.issues.length > 0
            ? `${uploadInfo.issues[0].path ? `${uploadInfo.issues[0].path}: ` : ""}${uploadInfo.issues[0].message}`
            : ""
        const message = uploadInfo.error || "Failed to prepare upload"
        throw new Error(issue ? `${message} (${issue})` : message)
      }
      return uploadInfo
    }

    const uploadSinglePut = (uploadInfo: { uploadUrl: string; publicUrl: string; contentType: string }) =>
      new Promise<{ url: string; size: number; type: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", uploadInfo.uploadUrl)
        xhr.setRequestHeader("Content-Type", uploadInfo.contentType)
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ url: uploadInfo.publicUrl, size: file.size, type: uploadInfo.contentType })
          } else {
            reject(new Error(buildXhrErrorMessage(xhr, "อัปโหลดไฟล์ไม่สำเร็จ")))
          }
        }
        xhr.onerror = () => reject(new Error(buildXhrErrorMessage(xhr, "อัปโหลดไฟล์ไม่สำเร็จ")))
        xhr.send(file)
      })

    const uploadInfo = await requestUploadInfo(false)
    if (uploadInfo.multipart) return await uploadMultipartFile(file, uploadInfo, onProgress, bucket)

    try {
      return await uploadSinglePut(uploadInfo)
    } catch (error) {
      const statusCode = extractStatusCode(error instanceof Error ? error.message : "")
      const shouldRetryMultipart =
        type === "video" &&
        (statusCode === 0 || statusCode === 413 || statusCode === 502 || statusCode === 503)

      if (!shouldRetryMultipart) throw error

      onProgress(0)
      const retryInfo = await requestUploadInfo(true)
      if (!retryInfo.multipart) throw error
      return await uploadMultipartFile(file, retryInfo, onProgress, bucket)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    const nextErrors: Record<string, string> = {}
    if (step === 1) {
      if (!videoFile) nextErrors.videoFile = "กรุณาเลือกไฟล์วิดีโอ"
    }
    if (step === 2) {
      if (!title.trim()) nextErrors.title = "กรุณากรอกชื่อวิดีโอ"
      if (!targetKeyword.trim()) nextErrors.targetKeyword = "กรุณากรอกคีย์เวิร์ดหลัก (Target keyword)"
    }
    if (step === 3) {
      if (tags.length > TAG_LIMIT) {
        nextErrors.tags = tagLimitMessage
        setTagError(tagLimitMessage)
      }
      if (visibility === "DOMAIN_RESTRICTED" && allowedDomainIds.length === 0) {
        nextErrors.allowedDomainIds = "กรุณาเลือกอย่างน้อยหนึ่งโดเมน"
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return
    if (seoPassed !== true) {
      toast.error("กรุณาผ่านการตรวจ SEO (ขั้นตอนที่ 4) ก่อนอัปโหลด")
      return
    }

    setLoading(true)
    setUploadStatus("กำลังอัปโหลดวิดีโอ...")
    setUploadProgress(0)

    try {
      const videoUpload = await uploadFile(videoFile!, "video", setUploadProgress, storageBucket)
      let thumbnailUrl: string | undefined

      if (thumbnailFile) {
        setUploadStatus("กำลังอัปโหลดรูปหน้าปก...")
        setUploadProgress(0)
        const thumbnailUpload = await uploadFile(thumbnailFile, "thumbnail", setUploadProgress, storageBucket)
        thumbnailUrl = thumbnailUpload.url
      }

      setUploadStatus("กำลังบันทึกข้อมูล...")
      const endpoint = storageBucket === "jav" ? "/api/av/videos" : "/api/media/videos"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          targetKeyword: targetKeyword.trim(),
          description: description.trim() || undefined,
          tags,
          actors,
          categoryIds,
          visibility,
          allowedDomainIds: visibility === "DOMAIN_RESTRICTED" ? allowedDomainIds : undefined,
          videoUrl: videoUpload.url,
          thumbnailUrl,
          fileSize: videoUpload.size,
          mimeType: videoUpload.type,
          storageBucket,
          ...(isAv
            ? {
                movieCode: movieCode.trim() || null,
                studio: studio.trim() || null,
                releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
              }
            : {}),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to create video")

      toast.success("อัปโหลดวิดีโอสำเร็จ!")
      router.push(`/videos/${result.video.id}`)
      router.refresh()
    } catch (error) {
      const message = formatUploadError(error)
      setUploadStatus(message)
      toast.error(message)
    } finally {
      setLoading(false)
      setUploadStatus("")
      setUploadProgress(0)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2 text-slate-600 hover:text-slate-900">
            <Link href="/videos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับไปหน้าวิดีโอ
            </Link>
          </Button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">อัปโหลดวิดีโอใหม่</h1>
              <p className="text-slate-500 text-sm">เพิ่มวิดีโอเข้าสู่ระบบ Media Storage</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted || step.id < currentStep) setCurrentStep(step.id)
                    }}
                    disabled={step.id > currentStep}
                    className={`flex items-center gap-2 transition-all ${
                      step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0 ${
                        isActive
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                          : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="hidden lg:block text-left">
                      <p className={`text-xs ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                        ขั้นตอน {step.id}
                      </p>
                      <p className={`text-xs font-medium ${isActive ? "text-slate-900" : "text-slate-600"}`}>
                        {step.title}
                      </p>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <div className="flex-1 mx-2">
                      <div
                        className={`h-1 rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-slate-200"}`}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">

            {/* ── Step 1: Type & Files ───────────────────────────────────────── */}
            {currentStep === 1 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FileVideo className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">เลือกประเภทและไฟล์</h2>
                    <p className="text-sm text-slate-500">เลือกประเภทคลิปและอัปโหลดไฟล์วิดีโอ</p>
                  </div>
                </div>

                {/* Video Type Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">ประเภทคลิป</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStorageBucket("media")}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                        storageBucket === "media"
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      {storageBucket === "media" && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="p-2 bg-blue-100 rounded-lg w-fit mb-3">
                        <Film className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="font-semibold text-slate-900">คลิปไทย</p>
                      <p className="text-xs text-slate-500 mt-1">คลิปทั่วไป วิดีโอสั้น</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStorageBucket("jav")}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                        storageBucket === "jav"
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      {storageBucket === "jav" && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="p-2 bg-pink-100 rounded-lg w-fit mb-3">
                        <Sparkles className="h-5 w-5 text-pink-600" />
                      </div>
                      <p className="font-semibold text-slate-900">หนัง AV</p>
                      <p className="text-xs text-slate-500 mt-1">หนังเต็มเรื่อง มีรหัส</p>
                    </button>
                  </div>
                </div>

                {/* Video Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">ไฟล์วิดีโอ *</Label>
                  <div
                    onDragOver={(e) => handleDragOver(e, setIsDraggingVideo)}
                    onDragLeave={(e) => handleDragLeave(e, setIsDraggingVideo)}
                    onDrop={handleVideoDrop}
                    className={`relative border-2 border-dashed rounded-xl transition-all ${
                      isDraggingVideo
                        ? "border-indigo-500 bg-indigo-50"
                        : videoFile
                          ? "border-emerald-300 bg-emerald-50"
                          : errors.videoFile
                            ? "border-red-300 bg-red-50"
                            : "border-slate-300 hover:border-slate-400 bg-slate-50"
                    }`}
                  >
                    {videoFile ? (
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          {videoPreview && (
                            <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-black flex-shrink-0">
                              <video src={videoPreview} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{videoFile.name}</p>
                            <p className="text-sm text-slate-500">{formatFileSize(videoFile.size)}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Check className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm text-emerald-600">พร้อมอัปโหลด</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVideoSelect(null)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
                        <div className="p-3 bg-slate-200 rounded-full mb-3">
                          <FileVideo className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="font-medium text-slate-700 mb-1">ลากไฟล์มาวางที่นี่</p>
                        <p className="text-sm text-slate-500 mb-3">หรือคลิกเพื่อเลือกไฟล์</p>
                        <p className="text-xs text-slate-400">MP4, WebM, MOV, AVI, TS (สูงสุด 20GB)</p>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mp2t,.ts"
                          onChange={(e) => handleVideoSelect(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {errors.videoFile && <p className="text-sm text-red-500">{errors.videoFile}</p>}
                </div>

                {/* Thumbnail Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">รูปหน้าปก (ไม่บังคับ)</Label>
                  <div
                    onDragOver={(e) => handleDragOver(e, setIsDraggingThumb)}
                    onDragLeave={(e) => handleDragLeave(e, setIsDraggingThumb)}
                    onDrop={handleThumbDrop}
                    className={`relative border-2 border-dashed rounded-xl transition-all ${
                      isDraggingThumb
                        ? "border-indigo-500 bg-indigo-50"
                        : thumbnailFile
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-300 hover:border-slate-400 bg-slate-50"
                    }`}
                  >
                    {thumbnailFile ? (
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          {thumbnailPreview && (
                            <img
                              src={thumbnailPreview}
                              alt="Thumbnail preview"
                              className="w-20 h-14 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate text-sm">{thumbnailFile.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(thumbnailFile.size)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleThumbnailSelect(null)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center gap-4 p-4 cursor-pointer">
                        <div className="p-2 bg-slate-200 rounded-lg">
                          <ImageIcon className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">เลือกรูปหน้าปก</p>
                          <p className="text-xs text-slate-400">JPG, PNG, WebP</p>
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleThumbnailSelect(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Video Info ─────────────────────────────────────────── */}
            {currentStep === 2 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Info className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">ข้อมูลวิดีโอ</h2>
                    <p className="text-sm text-slate-500">กรอกรายละเอียดเกี่ยวกับวิดีโอ</p>
                  </div>
                </div>

                {isAv && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="movie-code" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Hash className="h-4 w-4 text-slate-400" />
                        รหัสหนัง
                      </Label>
                      <Input
                        id="movie-code"
                        placeholder="เช่น ABC-123"
                        value={movieCode}
                        onChange={(e) => setMovieCode(e.target.value)}
                        className="bg-slate-50 border-slate-200 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        ค่ายหนัง
                      </Label>
                      <StudioSelect value={studio} onChange={setStudio} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-slate-700">
                    {isAv ? "ชื่อหนัง" : "ชื่อคลิป"} *
                  </Label>
                  <Input
                    id="title"
                    placeholder={isAv ? "กรอกชื่อหนัง" : "กรอกชื่อวิดีโอคลิป"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`bg-slate-50 border-slate-200 focus:bg-white ${errors.title ? "border-red-300" : ""}`}
                  />
                  {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-keyword" className="text-sm font-medium text-slate-700">
                    คีย์เวิร์ดหลัก (Target keyword) *
                  </Label>
                  <Input
                    id="target-keyword"
                    placeholder={isAv ? "เช่น รหัสหนัง หรือคีย์เวิร์ดที่ต้องการติดอันดับ" : "เช่น คำหลักที่ต้องการให้ค้นหาเจอ"}
                    value={targetKeyword}
                    onChange={(e) => setTargetKeyword(e.target.value)}
                    className={`bg-slate-50 border-slate-200 focus:bg-white ${
                      errors.targetKeyword ? "border-red-300" : ""
                    }`}
                  />
                  <p className="text-xs text-slate-500">
                    ใช้ 1 คำหลักที่ชัดเจน และควรมีอยู่ในชื่อ/คำอธิบาย/แท็ก
                  </p>
                  {errors.targetKeyword && <p className="text-sm text-red-500">{errors.targetKeyword}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-slate-700">
                    {isAv ? "เนื้อหาหนัง" : "รายละเอียด"}
                  </Label>
                  <Textarea
                    id="description"
                    placeholder={isAv ? "สรุปเนื้อหาแบบย่อ" : "เพิ่มคำอธิบายสั้น ๆ สำหรับผู้ชม"}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-50 border-slate-200 focus:bg-white resize-none"
                  />
                </div>

                {isAv && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="release-date"
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                    >
                      <Calendar className="h-4 w-4 text-slate-400" />
                      วันที่ออกจำหน่าย
                    </Label>
                    <Input
                      id="release-date"
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="bg-slate-50 border-slate-200 focus:bg-white w-fit"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Users className="h-4 w-4 text-slate-400" />
                    ดารา/นักแสดง
                  </Label>
                  <ActorSelect value={actors} onChange={setActors} />
                  {actors.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {actors.map((actor) => (
                        <Badge key={actor} variant="secondary" className="bg-slate-100">
                          {actor}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Categories & Tags ─────────────────────────────────── */}
            {currentStep === 3 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Tag className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">หมวดหมู่และแท็ก</h2>
                    <p className="text-sm text-slate-500">จัดหมวดหมู่และเพิ่มแท็กให้วิดีโอ</p>
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <FolderOpen className="h-4 w-4 text-slate-400" />
                    หมวดหมู่
                  </Label>
                  {categories.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-sm text-slate-500 text-center">
                      ยังไม่มีหมวดหมู่
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            categoryIds.includes(category.id)
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <Checkbox
                            checked={categoryIds.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
                          <span className="text-sm font-medium text-slate-700">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Add new category */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <Label htmlFor="new-cat-switch" className="text-sm text-slate-600 cursor-pointer">
                      เพิ่มหมวดหมู่ใหม่
                    </Label>
                    <Switch
                      id="new-cat-switch"
                      checked={enableNewCategory}
                      onCheckedChange={handleToggleNewCategory}
                    />
                  </div>
                  {enableNewCategory && (
                    <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="พิมพ์ชื่อหมวดหมู่"
                          value={newCategoryName}
                          onChange={(e) => {
                            setNewCategoryName(e.target.value)
                            if (categoryError) setCategoryError(null)
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleCreateCategory}
                          disabled={creatingCategory || !newCategoryName.trim()}
                        >
                          {creatingCategory ? "กำลังเพิ่ม..." : "เพิ่ม"}
                        </Button>
                      </div>
                      {categoryError && <p className="text-sm text-red-500">{categoryError}</p>}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Tag className="h-4 w-4 text-slate-400" />
                    {tagLabel}
                    <span className="text-slate-400 font-normal">
                      ({tags.length}/{TAG_LIMIT})
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={tagPlaceholder}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="flex-1 bg-slate-50 border-slate-200 focus:bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || tags.length >= TAG_LIMIT}
                    >
                      เพิ่ม
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 gap-1 pr-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`ลบแท็ก ${tag}`}
                            className="ml-1 hover:text-red-500 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tagError && <p className="text-sm text-red-500">{tagError}</p>}

                  {/* Quick tags */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">แท็กยอดนิยม — คลิกเพื่อเพิ่ม</p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-50 border border-slate-200">
                      {tagOptions.map((tag) => {
                        const selected = normalizedTags.has(tag.toLowerCase())
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTagOption(tag)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              selected
                                ? "bg-indigo-500 text-white"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Eye className="h-4 w-4 text-slate-400" />
                    การเผยแพร่
                  </Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">🌐 เผยแพร่สาธารณะ</SelectItem>
                      <SelectItem value="PRIVATE">🔒 ส่วนตัว</SelectItem>
                      <SelectItem value="DOMAIN_RESTRICTED">🔗 เจาะจงโดเมน</SelectItem>
                    </SelectContent>
                  </Select>

                  {visibility === "DOMAIN_RESTRICTED" && (
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                      <p className="text-sm font-medium text-slate-700">เลือกโดเมนที่อนุญาต</p>
                      {activeDomains.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          ไม่มีโดเมนที่ใช้งาน{" "}
                          <Link href="/settings/domains" className="text-indigo-600 underline">
                            เพิ่มโดเมน
                          </Link>
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {activeDomains.map((domain) => (
                            <label
                              key={domain.id}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                                allowedDomainIds.includes(domain.id)
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <Checkbox
                                checked={allowedDomainIds.includes(domain.id)}
                                onCheckedChange={() => toggleDomain(domain.id)}
                              />
                              <span className="text-sm">{domain.domain}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {errors.allowedDomainIds && (
                        <p className="text-sm text-red-500">{errors.allowedDomainIds}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: SEO Check ─────────────────────────────────────────── */}
            {currentStep === 4 && (
              <div className="p-6 sm:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <BarChart2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">ตรวจคะแนน SEO</h2>
                    <p className="text-sm text-slate-500">
                      ตรวจสอบคุณภาพข้อมูลก่อนอัปโหลด — ต้องได้คะแนน {SEO_PASS_SCORE}/100 ขึ้นไป
                    </p>
                  </div>
                </div>

                {/* Stale warning */}
                {seoIsStale && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>ข้อมูลวิดีโอมีการเปลี่ยนแปลง กรุณาตรวจ SEO ใหม่อีกครั้ง</span>
                  </div>
                )}

                {/* Idle state */}
                {seoStatus === "idle" && (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <BarChart2 className="h-10 w-10 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-slate-700 mb-1">พร้อมตรวจคะแนน SEO</p>
                      <p className="text-sm text-slate-500">
                        ระบบจะตรวจสอบชื่อ, Target keyword, คำอธิบาย, แท็ก และรูปหน้าปก
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleRunSeo()}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 px-6"
                    >
                      <BarChart2 className="h-4 w-4" />
                      เริ่มตรวจ SEO
                    </Button>
                  </div>
                )}

                {/* Running state */}
                {seoStatus === "running" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-indigo-600 animate-spin flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-600 font-medium">กำลังตรวจสอบ...</span>
                          <span className="text-indigo-600 font-medium">{seoProgress}%</span>
                        </div>
                        <Progress value={seoProgress} className="h-2" />
                      </div>
                    </div>

                    {/* Streaming check results */}
                    <div className="space-y-2">
                      {seoChecks.map((check) => (
                        <div
                          key={check.key}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            check.passed
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                              check.passed ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          >
                            {check.passed ? (
                              <Check className="h-3 w-3 text-white" />
                            ) : (
                              <X className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">{check.label}</p>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {check.earned}/{check.weight}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{check.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Done state */}
                {seoStatus === "done" && (
                  <div className="space-y-5">
                    {/* Score card */}
                    <div
                      className={`rounded-xl border-2 p-5 ${
                        seoPassed
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-red-50 border-red-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {seoPassed ? (
                            <div className="p-1.5 bg-emerald-500 rounded-full">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          ) : (
                            <div className="p-1.5 bg-red-500 rounded-full">
                              <X className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <span className={`font-semibold text-lg ${seoPassed ? "text-emerald-800" : "text-red-800"}`}>
                            {seoPassed ? "ผ่าน SEO" : "ไม่ผ่าน SEO"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-3xl font-bold ${seoPassed ? "text-emerald-700" : "text-red-700"}`}
                          >
                            {seoScore}
                          </span>
                          <span className="text-slate-500 text-lg">/100</span>
                        </div>
                      </div>
                      <Progress
                        value={seoScore ?? 0}
                        className={`h-3 ${seoPassed ? "[&>div]:bg-emerald-500" : "[&>div]:bg-red-500"}`}
                      />
                      <p className={`text-xs mt-2 ${seoPassed ? "text-emerald-700" : "text-red-700"}`}>
                        เกณฑ์ผ่าน: {SEO_PASS_SCORE}/100 คะแนน และต้องผ่านเงื่อนไขสำคัญทุกข้อ
                      </p>
                    </div>

                    {/* Check results */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-slate-700">รายการตรวจสอบ</h3>
                      {seoChecks.map((check) => (
                        <div
                          key={check.key}
                          className={`rounded-lg border overflow-hidden ${
                            check.passed ? "border-emerald-200" : "border-red-200"
                          }`}
                        >
                          <div
                            className={`flex items-center gap-3 px-4 py-3 ${
                              check.passed ? "bg-emerald-50" : "bg-red-50"
                            }`}
                          >
                            <div
                              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                                check.passed ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            >
                              {check.passed ? (
                                <Check className="h-3 w-3 text-white" />
                              ) : (
                                <X className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="flex-1 text-sm font-medium text-slate-800">{check.label}</span>
                            {check.isCritical && (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                                สำคัญ
                              </Badge>
                            )}
                            <span className="text-xs text-slate-500">
                              {check.earned}/{check.weight}
                            </span>
                          </div>
                          {(!check.passed || check.suggestion) && (
                            <div className="px-4 py-2 bg-white border-t border-slate-100 space-y-1">
                              <p className="text-xs text-slate-600">{check.message}</p>
                              {!check.passed && check.suggestion && (
                                <p className="text-xs text-amber-700 flex items-start gap-1">
                                  <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  {check.suggestion}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    {seoRecommendations.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          คำแนะนำในการปรับปรุง
                        </p>
                        <ul className="space-y-1">
                          {seoRecommendations.map((rec, i) => (
                            <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                              <span className="mt-0.5 flex-shrink-0">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRunSeo()}
                        disabled={isGenerating}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        ตรวจใหม่
                      </Button>

                      {!seoPassed && (
                        <Button
                          type="button"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              กำลัง Generate...
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-4 w-4" />
                              Generate ใหม่ (คะแนนสูงสุด)
                            </>
                          )}
                        </Button>
                      )}

                      {seoPassed && (
                        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                          <Check className="h-4 w-4" />
                          SEO ผ่านแล้ว — กดถัดไปเพื่ออัปโหลด
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 5: Review & Upload ───────────────────────────────────── */}
            {currentStep === 5 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Check className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">ตรวจสอบและอัปโหลด</h2>
                    <p className="text-sm text-slate-500">ตรวจสอบข้อมูลก่อนอัปโหลด</p>
                  </div>
                </div>

                {/* SEO gate banner */}
                {seoPassed !== true && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">ยังไม่ผ่านการตรวจ SEO</p>
                      <p className="text-xs text-red-600 mt-1">
                        {seoStatus === "idle"
                          ? "กรุณากลับไปขั้นตอนที่ 4 เพื่อเริ่มตรวจ SEO ก่อนอัปโหลด"
                          : `คะแนน SEO (${seoScore ?? 0}/100) ต่ำกว่าเกณฑ์ กรุณากลับไปแก้ไขหรือกด Generate ใหม่`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentStep(4)}
                      className="ml-auto flex-shrink-0 border-red-300 text-red-700 hover:bg-red-100"
                    >
                      ไปขั้นตอน SEO
                    </Button>
                  </div>
                )}

                {/* SEO score summary if passed */}
                {seoPassed === true && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="p-1.5 bg-emerald-500 rounded-full">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm text-emerald-800 font-medium">
                      SEO ผ่านแล้ว — คะแนน {seoScore}/100
                    </span>
                  </div>
                )}

                {/* Preview */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900">ตัวอย่างวิดีโอ</h3>
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                      {videoPreview ? (
                        <video src={videoPreview} controls className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">ไม่มีตัวอย่าง</div>
                      )}
                    </div>
                    {thumbnailPreview && (
                      <div>
                        <p className="text-sm text-slate-500 mb-2">รูปหน้าปก</p>
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail"
                          className="w-32 h-20 rounded-lg object-cover border border-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900">ข้อมูลวิดีโอ</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">ประเภท</span>
                        <span className="font-medium">{isAv ? "หนัง AV" : "คลิปไทย"}</span>
                      </div>
                      {isAv && movieCode && (
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">รหัสหนัง</span>
                          <span className="font-medium">{movieCode}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">ชื่อ</span>
                        <span className="font-medium truncate ml-4">{title || "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Target keyword</span>
                        <span className="font-medium truncate ml-4">{targetKeyword || "-"}</span>
                      </div>
                      {isAv && studio && (
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-500">ค่ายหนัง</span>
                          <span className="font-medium">{studio}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">ไฟล์</span>
                        <span className="font-medium">{videoFile ? formatFileSize(videoFile.size) : "-"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">การเผยแพร่</span>
                        <span className="font-medium">
                          {visibility === "PUBLIC"
                            ? "🌐 สาธารณะ"
                            : visibility === "PRIVATE"
                              ? "🔒 ส่วนตัว"
                              : "🔗 เจาะจงโดเมน"}
                        </span>
                      </div>
                      {actors.length > 0 && (
                        <div className="py-2 border-b border-slate-100">
                          <span className="text-slate-500 block mb-2">นักแสดง</span>
                          <div className="flex flex-wrap gap-1">
                            {actors.map((actor) => (
                              <Badge key={actor} variant="secondary" className="text-xs">
                                {actor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="py-2">
                          <span className="text-slate-500 block mb-2">แท็ก ({tags.length})</span>
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 10).map((tag) => (
                              <Badge key={tag} className="text-xs bg-indigo-100 text-indigo-700">
                                {tag}
                              </Badge>
                            ))}
                            {tags.length > 10 && (
                              <Badge variant="outline" className="text-xs">
                                +{tags.length - 10} อื่นๆ
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload Progress */}
                {loading && (
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                      <span className="font-medium text-indigo-900">{uploadStatus}</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-indigo-600 text-right">{uploadProgress}%</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Navigation Footer ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between p-6 bg-slate-50 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || loading}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                ย้อนกลับ
              </Button>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                ขั้นตอน {currentStep} จาก {steps.length}
              </div>

              {currentStep < steps.length ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={currentStep === 4 && seoStatus === "running"}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  ถัดไป
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || seoPassed !== true}
                  className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังอัปโหลด...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      อัปโหลดวิดีโอ
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Help Card */}
        <div className="mt-6 p-4 rounded-xl bg-slate-100 border border-slate-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Info className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-700 mb-1">ข้อแนะนำ</p>
              <ul className="text-slate-500 space-y-1">
                <li>• รองรับไฟล์ MP4, WebM, MOV, AVI, TS ขนาดไม่เกิน 20GB</li>
                <li>• รูปหน้าปกแนะนำขนาด 1280x720 พิกเซล</li>
                <li>• ใส่แท็กที่เกี่ยวข้องและกรอกคำอธิบายเพื่อคะแนน SEO ที่ดี</li>
                <li>• ต้องผ่านการตรวจ SEO (ขั้นตอนที่ 4) จึงจะอัปโหลดได้</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
