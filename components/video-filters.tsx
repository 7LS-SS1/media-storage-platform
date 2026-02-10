"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

interface Category {
  id: string
  name: string
}

export function VideoFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [category, setCategory] = useState(searchParams.get("categoryId") || "all")
  const [visibility, setVisibility] = useState(searchParams.get("visibility") || "all")
  const [sort, setSort] = useState(searchParams.get("sort") || "newest")
  const [storageBucket, setStorageBucket] = useState(searchParams.get("storageBucket") || "all")
  const [categories, setCategories] = useState<Category[]>([])

  // Fetch categories
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const applyFilters = (overrides?: { storageBucket?: string }) => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (category !== "all") params.set("categoryId", category)
    if (visibility !== "all") params.set("visibility", visibility)
    if (sort !== "newest") params.set("sort", sort)
    const nextBucket = overrides?.storageBucket ?? storageBucket
    if (nextBucket !== "all") params.set("storageBucket", nextBucket)
    params.set("page", "1")

    router.push(`/videos?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch("")
    setCategory("all")
    setVisibility("all")
    setSort("newest")
    setStorageBucket("all")
    router.push("/videos")
  }

  const hasActiveFilters =
    search || category !== "all" || visibility !== "all" || sort !== "newest" || storageBucket !== "all"

  return (
    <div className="mb-6 space-y-4">
      <Tabs value={storageBucket} onValueChange={(value) => {
        setStorageBucket(value)
        applyFilters({ storageBucket: value })
      }}>
        <TabsList>
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          <TabsTrigger value="media">คลิปไทย</TabsTrigger>
          <TabsTrigger value="jav">หนัง AV</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search videos by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {/* Category Filter */}
        <Select value={category} onValueChange={(value) => setCategory(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Visibility Filter */}
        <Select value={visibility} onValueChange={(value) => setVisibility(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visibility</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
            <SelectItem value="PRIVATE">Private</SelectItem>
            <SelectItem value="DOMAIN_RESTRICTED">Domain Restricted</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sort} onValueChange={(value) => setSort(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
          </SelectContent>
        </Select>

        {/* Apply & Clear Buttons */}
        <Button onClick={applyFilters} variant="default">
          Apply Filters
        </Button>

        {hasActiveFilters && (
          <Button onClick={clearFilters} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
