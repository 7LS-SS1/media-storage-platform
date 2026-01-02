"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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
  const [categoryId, setCategoryId] = useState<string>("none")
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC")
  const [allowedDomainIds, setAllowedDomainIds] = useState<string[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const uploadFile = async (
    file: File,
    type: "video" | "thumbnail",
    onProgress: (progress: number) => void,
  ) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", type)

    return await new Promise<{ url: string; size: number; type: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload")
      xhr.responseType = "json"
      xhr.withCredentials = true

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }

      xhr.onload = () => {
        const status = xhr.status
        const response =
          xhr.response ??
          (() => {
            try {
              return xhr.responseText ? JSON.parse(xhr.responseText) : null
            } catch {
              return null
            }
          })()

        if (status >= 200 && status < 300) {
          resolve(response as { url: string; size: number; type: string })
        } else {
          reject(new Error(response?.error || "Upload failed"))
        }
      }

      xhr.onerror = () => reject(new Error("Upload failed"))
      xhr.send(formData)
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
          categoryId: categoryId === "none" ? undefined : categoryId,
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
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกหมวดหมู่" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
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
                <p>รองรับไฟล์ : MP4, WebM, MOV, AVI</p>
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
