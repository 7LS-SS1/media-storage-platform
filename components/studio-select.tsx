"use client"

import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface StudioSelectProps {
  value: string
  onChange: (nextValue: string) => void
}

interface StudioOption {
  id: string
  name: string
}

const uniqueByLowercase = (items: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []
  items.forEach((item) => {
    const cleaned = item.trim()
    if (!cleaned) return
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(cleaned)
  })
  return result
}

export function StudioSelect({ value, onChange }: StudioSelectProps) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStudios() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/studios")
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Failed to fetch studios")
        }
        const data = (await response.json()) as { studios: StudioOption[] }
        if (!cancelled) {
          const names = data.studios.map((studio) => studio.name)
          const next = uniqueByLowercase(names).sort((a, b) => a.localeCompare(b))
          setOptions(next)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch studios"
        if (!cancelled) {
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchStudios()

    return () => {
      cancelled = true
    }
  }, [])

  const mergedOptions = useMemo(
    () => uniqueByLowercase([...options, ...(value ? [value] : [])]),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return mergedOptions
    const query = search.trim().toLowerCase()
    return mergedOptions.filter((item) => item.toLowerCase().includes(query))
  }, [mergedOptions, search])

  const canCreate = useMemo(() => {
    if (!search.trim()) return false
    const query = search.trim().toLowerCase()
    return !mergedOptions.some((item) => item.toLowerCase() === query)
  }, [mergedOptions, search])

  const handleSelect = (name: string) => {
    onChange(name)
    setOpen(false)
    setSearch("")
  }

  const handleClear = () => {
    onChange("")
    setOpen(false)
    setSearch("")
  }

  const handleCreate = () => {
    const name = search.trim()
    if (!name) return
    setOptions((current) => {
      const next = uniqueByLowercase([...current, name])
      next.sort((a, b) => a.localeCompare(b))
      return next
    })
    onChange(name)
    setOpen(false)
    setSearch("")
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && canCreate) {
      event.preventDefault()
      handleCreate()
    }
  }

  return (
    <div className="space-y-3">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value ? value : "เลือกค่ายหนัง"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="ค้นหาค่ายหนัง..."
              value={search}
              onValueChange={setSearch}
              onKeyDown={handleInputKeyDown}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังโหลดรายการ...
                </div>
              )}
              {!loading && error && (
                <div className="px-3 py-2 text-sm text-destructive">{error}</div>
              )}
              {!loading && !error && filteredOptions.length === 0 && !canCreate && (
                <div className="px-3 py-2 text-sm text-muted-foreground">ไม่พบรายการ</div>
              )}
              {!loading && (
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={handleClear}>
                    <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                    <span className="flex-1">ไม่ระบุ</span>
                  </CommandItem>
                  {filteredOptions.map((name) => {
                    const selected = value.toLowerCase() === name.toLowerCase()
                    return (
                      <CommandItem key={name} value={name} onSelect={() => handleSelect(name)}>
                        <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{name}</span>
                        {selected && <span className="text-xs text-muted-foreground">เลือกแล้ว</span>}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
              {!loading && canCreate && (
                <CommandGroup>
                  <CommandItem value={search.trim()} onSelect={handleCreate}>
                    <Plus className="h-4 w-4" />
                    เพิ่ม "{search.trim()}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            {value}
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove studio"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  )
}
