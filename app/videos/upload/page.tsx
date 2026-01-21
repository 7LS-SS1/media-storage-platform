"use client"

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UploadCloud, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ActorSelect } from "@/components/actor-select"
import { STANDARD_TAGS } from "@/lib/standard-tags"
import { TAG_LIMIT } from "@/lib/tag-constraints"

interface Category {
  id: string
  name: string
}

interface Domain {
  id: string
  domain: string
  isActive: boolean
}

type Visibility = "PUBLIC" | "PRIVATE" | "DOMAIN_RESTRICTED"

export default function UploadVideoPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [actors, setActors] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC")
  const [allowedDomainIds, setAllowedDomainIds] = useState<string[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
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

  const normalizedTags = useMemo(() => new Set(tags.map((tag) => tag.toLowerCase())), [tags])
  const tagLimitMessage = `เพิ่มแท็กได้สูงสุด ${TAG_LIMIT} รายการ`

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")

  useEffect(() => {
    if (tagError && tags.length < TAG_LIMIT) {
      setTagError(null)
    }
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
    if (hitLimit) {
      setTagError(tagLimitMessage)
    } else {
      setTagError(null)
    }
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

  const handleToggleNewCategory = (checked: boolean) => {
    setEnableNewCategory(checked)
    if (!checked) {
      setNewCategoryName("")
      setCategoryError(null)
    }
  }

  const toggleStandardTag = (tag: string) => {
    let hitLimit = false
    setTags((current) => {
      const key = tag.toLowerCase()
      const exists = current.some((value) => value.toLowerCase() === key)
      if (exists) {
        return current.filter((value) => value.toLowerCase() !== key)
      }
      if (current.length >= TAG_LIMIT) {
        hitLimit = true
        return current
      }
      return [...current, tag]
    })
    if (hitLimit) {
      setTagError(tagLimitMessage)
    } else {
      setTagError(null)
    }
  }

  const addAllStandardTags = () => {
    let hitLimit = false
    setTags((current) => {
      const seen = new Set(current.map((value) => value.toLowerCase()))
      const merged = [...current]
      for (const tag of STANDARD_TAGS) {
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
    if (hitLimit) {
      setTagError(tagLimitMessage)
    } else {
      setTagError(null)
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
        body: JSON.stringify({
          name,
          slug: slugify(name) || name,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create category")
      }

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
    }

    if (visibility !== "DOMAIN_RESTRICTED") {
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
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )
  }

  const uploadFile = async (
    file: File,
    type: "video" | "thumbnail",
    onProgress: (progress: number) => void,
  ) => {
    const uploadResponse = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        type,
      }),
    })

    const uploadInfo = await uploadResponse.json()
    if (!uploadResponse.ok) {
      throw new Error(uploadInfo.error || "Failed to prepare upload")
    }

    return await new Promise<{ url: string; size: number; type: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", uploadInfo.uploadUrl)
      xhr.setRequestHeader("Content-Type", uploadInfo.contentType)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: uploadInfo.publicUrl, size: file.size, type: uploadInfo.contentType })
        } else {
          reject(new Error("Upload failed"))
        }
      }

      xhr.onerror = () => reject(new Error("Upload failed"))
      xhr.send(file)
    })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!title.trim()) {
      nextErrors.title = "Title is required"
    }
    if (!videoFile) {
      nextErrors.videoFile = "Video file is required"
    }
    if (tags.length > TAG_LIMIT) {
      nextErrors.tags = tagLimitMessage
      setTagError(tagLimitMessage)
    }
    if (visibility === "DOMAIN_RESTRICTED" && allowedDomainIds.length === 0) {
      nextErrors.allowedDomainIds = "Select at least one allowed domain"
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setLoading(true)
    setUploadStatus("Uploading video...")
    setUploadProgress(0)

    try {
      const videoUpload = await uploadFile(videoFile!, "video", setUploadProgress)
      let thumbnailUrl: string | undefined

      if (thumbnailFile) {
        setUploadStatus("Uploading thumbnail...")
        setUploadProgress(0)
        const thumbnailUpload = await uploadFile(thumbnailFile, "thumbnail", setUploadProgress)
        thumbnailUrl = thumbnailUpload.url
      }

      setUploadStatus("Saving video details...")
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          tags,
          actors,
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
          visibility,
          allowedDomainIds: visibility === "DOMAIN_RESTRICTED" ? allowedDomainIds : undefined,
          videoUrl: videoUpload.url,
          thumbnailUrl,
          fileSize: videoUpload.size,
          mimeType: videoUpload.type,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to create video")
      }

      toast.success("Video created successfully")
      router.push(`/videos/${result.video.id}`)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed"
      toast.error(message)
    } finally {
      setLoading(false)
      setUploadStatus("")
      setUploadProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/videos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Videos
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-2xl">เพิ่มวิดีโอ</CardTitle>
              <CardDescription>กรอกข้อมูลเกี่ยวกับวิดีโอ ไลฟ์วิดีโอและรูปหน้าปก.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">ชื่อคลิป</Label>
                  <Input
                    id="title"
                    placeholder="กรอกชื่อวิดีโอคลิป"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">รายละเอียด</Label>
                  <Textarea
                    id="description"
                    placeholder="เพิ่มคำอธิบายสั้น ๆ สำหรับผู้ชม"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>หมวดหมู่</Label>
                    {categories.length === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        ยังไม่มีหมวดหมู่
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center gap-2 rounded-md border p-2 text-sm"
                          >
                            <Checkbox
                              checked={categoryIds.includes(category.id)}
                              onCheckedChange={() => toggleCategory(category.id)}
                            />
                            <span>{category.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {categoryIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {categories
                          .filter((category) => categoryIds.includes(category.id))
                          .map((category) => (
                            <Badge key={category.id} variant="secondary">
                              {category.name}
                            </Badge>
                          ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
                      <Label htmlFor="new-category-switch">เพิ่มหมวดหมู่ใหม่</Label>
                      <Switch
                        id="new-category-switch"
                        checked={enableNewCategory}
                        onCheckedChange={handleToggleNewCategory}
                      />
                    </div>
                    {enableNewCategory && (
                      <div className="space-y-2 rounded-md border border-dashed p-3">
                        <Label htmlFor="new-category">ชื่อหมวดหมู่ใหม่</Label>
                        <div className="flex gap-2">
                          <Input
                            id="new-category"
                            placeholder="พิมพ์ชื่อหมวดหมู่"
                            value={newCategoryName}
                            onChange={(event) => {
                              setNewCategoryName(event.target.value)
                              if (categoryError) setCategoryError(null)
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCreateCategory}
                            disabled={creatingCategory || !newCategoryName.trim()}
                          >
                            {creatingCategory ? "กำลังเพิ่ม..." : "เพิ่ม"}
                          </Button>
                        </div>
                        {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>เผยแพร่</Label>
                    <Select value={visibility} onValueChange={(value) => setVisibility(value as Visibility)}>
                      <SelectTrigger>
                        <SelectValue placeholder="การเผยแพร่" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">เผยแพร่</SelectItem>
                        <SelectItem value="PRIVATE">ส่วนตัว</SelectItem>
                        <SelectItem value="DOMAIN_RESTRICTED">เจาะจง Domain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags-input">แท็ก</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="tags-input"
                      placeholder="พิมพ์แท็กแล้วกด Enter หรือใส่คอมม่า"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="min-w-[220px] flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || tags.length >= TAG_LIMIT}
                    >
                      เพิ่มแท็ก
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {tagError && <p className="text-sm text-destructive">{tagError}</p>}
                  <p className="text-xs text-muted-foreground">
                    แยกแท็กด้วยคอมม่า และกด Enter เพื่อเพิ่ม ({tags.length}/{TAG_LIMIT})
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>แท็กมาตรฐาน</Label>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">คลิกเพื่อเพิ่ม/ลบแท็กจากรายการมาตรฐาน</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllStandardTags}
                      disabled={tags.length >= TAG_LIMIT}
                    >
                      เพิ่มแท๊กทั้งหมด
                    </Button>
                  </div>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md border p-2">
                    {STANDARD_TAGS.map((tag) => {
                      const selected = normalizedTags.has(tag.toLowerCase())
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleStandardTag(tag)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 text-muted-foreground hover:border-primary"
                          }`}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ดารา/นักแสดง</Label>
                  <ActorSelect value={actors} onChange={setActors} />
                </div>

                {visibility === "DOMAIN_RESTRICTED" && (
                  <div className="space-y-2">
                    <Label>Domains ที่อนุญาต</Label>
                    {activeDomains.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        ไม่มี Domains ที่ใช้งานอยู่ เพิ่ม Domains ใน{" "}
                        <Link href="/settings/domains" className="text-primary underline">
                          การตั้งค่าโดเมน
                        </Link>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {activeDomains.map((domain) => (
                          <label
                            key={domain.id}
                            className="flex items-center gap-2 rounded-md border p-3 text-sm"
                          >
                            <Checkbox
                              checked={allowedDomainIds.includes(domain.id)}
                              onCheckedChange={() => toggleDomain(domain.id)}
                            />
                            <span>{domain.domain}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {errors.allowedDomainIds && <p className="text-sm text-destructive">{errors.allowedDomainIds}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="video-file">ไฟล์วิดีโอ</Label>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mp2t,.ts"
                    onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                  />
                  {videoFile && <p className="text-sm text-muted-foreground">{videoFile.name}</p>}
                  {errors.videoFile && <p className="text-sm text-destructive">{errors.videoFile}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thumbnail-file">รูปหน้าปก (optional)</Label>
                  <Input
                    id="thumbnail-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
                  />
                  {thumbnailFile && <p className="text-sm text-muted-foreground">{thumbnailFile.name}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={loading}>
                    <UploadCloud className="h-4 w-4 mr-2" />
                    {loading ? "Uploading..." : "Upload Video"}
                  </Button>
                  {uploadStatus && <span className="text-sm text-muted-foreground">{uploadStatus}</span>}
                </div>
                {loading && uploadStatus.includes("Uploading") && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>ข้อแนะนำในการอัปโหลด</CardTitle>
                <CardDescription>รายละเอียดการอัปโหลดไฟล์วิดีโอและรูปภาพหน้าปกคลิป</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>ขนาดไฟล์สูงสุด : 5GB</p>
                <p>รองรับไฟล์ : MP4, WebM, MOV, AVI, TS</p>
                <p>ชนิดรูปหน้าปก : JPG, PNG, WebP</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>การมองเห็น</CardTitle>
                <CardDescription>ควบคุมผู้ที่สามารถเข้าถึงวิดีโอได้</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  วิดีโอสาธารณะจะปรากฏให้ทุกคนเห็น วิดีโอส่วนตัวจะมองเห็นได้เฉพาะคุณและผู้ดูแลระบบ.
                </p>
                <p>วิดีโอที่จำกัดโดเมนสามารถฝังได้เฉพาะบนโดเมนที่อนุมัติเท่านั้น</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
