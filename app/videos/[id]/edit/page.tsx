"use client"

import React, { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface VideoAllowedDomain {
  domainId: string
}

interface Video {
  id: string
  title: string
  description: string | null
  actors: string[]
  tags: string[]
  categories: { id: string; name: string }[]
  visibility: "PUBLIC" | "PRIVATE" | "DOMAIN_RESTRICTED"
  allowedDomains?: VideoAllowedDomain[]
}

interface PageProps {
  params: Promise<{ id: string }>
}

type Visibility = "PUBLIC" | "PRIVATE" | "DOMAIN_RESTRICTED"

export default function EditVideoPage({ params }: PageProps) {
  const { id } = React.use(params)
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [actors, setActors] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [tagError, setTagError] = useState<string | null>(null)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC")
  const [allowedDomainIds, setAllowedDomainIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const normalizedTags = useMemo(() => new Set(tags.map((tag) => tag.toLowerCase())), [tags])
  const tagLimitMessage = `เพิ่มแท็กได้สูงสุด ${TAG_LIMIT} รายการ`

  useEffect(() => {
    if (tagError && tags.length < TAG_LIMIT) {
      setTagError(null)
    }
  }, [tagError, tags.length])

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setLoadError(null)
      try {
        const [videoResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/videos/${id}`, { credentials: "include" }),
          fetch("/api/categories"),
        ])

        if (!videoResponse.ok) {
          const errorData = await videoResponse.json().catch(() => null)
          throw new Error(errorData?.error || "Failed to load video")
        }

        const videoData = (await videoResponse.json()) as { video: Video }
        if (!cancelled) {
          const video = videoData.video
          setTitle(video.title ?? "")
          setDescription(video.description ?? "")
          setActors(video.actors ?? [])
          setTags(video.tags ?? [])
          setCategoryIds(video.categories?.map((category) => category.id) ?? [])
          setVisibility(video.visibility ?? "PUBLIC")
          setAllowedDomainIds(video.allowedDomains?.map((allowed) => allowed.domainId) ?? [])
        }

        if (categoriesResponse.ok) {
          const categoryData = await categoriesResponse.json()
          if (!cancelled) {
            setCategories(categoryData.categories)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load video"
        if (!cancelled) {
          setLoadError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (visibility !== "DOMAIN_RESTRICTED") {
      setAllowedDomainIds([])
      return
    }

    let cancelled = false

    async function fetchDomains() {
      try {
        const response = await fetch("/api/domains", { credentials: "include" })
        if (response.ok) {
          const data = await response.json()
          if (!cancelled) {
            setDomains(data.domains)
          }
        } else if (response.status === 403) {
          toast.error("Only admins can manage domain restrictions.")
        }
      } catch (error) {
        console.error("Failed to fetch domains:", error)
      }
    }

    fetchDomains()

    return () => {
      cancelled = true
    }
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

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleAddTag()
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove))
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}

    if (!title.trim()) {
      nextErrors.title = "Title is required"
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

    setSaving(true)

    try {
      const response = await fetch(`/api/videos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          actors,
          tags,
          categoryIds,
          visibility,
          allowedDomainIds: visibility === "DOMAIN_RESTRICTED" ? allowedDomainIds : undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to update video")
      }

      toast.success("Video updated successfully")
      router.push(`/videos/${id}`)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update video"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/videos/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Video
          </Link>
        </Button>

        {loading ? (
          <Card className="h-64 animate-pulse bg-muted" />
        ) : loadError ? (
          <Card>
            <CardHeader>
              <CardTitle>ไม่พบวิดีโอ</CardTitle>
              <CardDescription>{loadError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/videos">กลับไปหน้ารวมวิดีโอ</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-2xl">แก้ไขวิดีโอ</CardTitle>
                <CardDescription>ปรับข้อมูลชื่อ คำอธิบาย หมวดหมู่ และการมองเห็น</CardDescription>
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
                          <Link href="/admin/domains" className="text-primary underline">
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
                      {errors.allowedDomainIds && (
                        <p className="text-sm text-destructive">{errors.allowedDomainIds}</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                    </Button>
                    <Button variant="outline" type="button" asChild>
                      <Link href={`/videos/${id}`}>ยกเลิก</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>ข้อมูลไฟล์</CardTitle>
                  <CardDescription>ไฟล์วิดีโอและรูปหน้าปกไม่สามารถเปลี่ยนได้จากหน้านี้</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>หากต้องการเปลี่ยนไฟล์วิดีโอหรือรูปหน้าปก ให้ลบวิดีโอเดิมแล้วอัปโหลดใหม่</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>การมองเห็น</CardTitle>
                  <CardDescription>ควบคุมผู้ที่สามารถเข้าถึงวิดีโอได้</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>วิดีโอสาธารณะจะปรากฏให้ทุกคนเห็น วิดีโอส่วนตัวจะมองเห็นได้เฉพาะคุณและผู้ดูแลระบบ.</p>
                  <p>วิดีโอที่จำกัดโดเมนสามารถฝังได้เฉพาะบนโดเมนที่อนุมัติเท่านั้น</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
