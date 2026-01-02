"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Globe } from "lucide-react"
import { toast } from "sonner"

interface Domain {
  id: string
  domain: string
  isActive: boolean
  createdAt: string
}

export function DomainManager() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [newDomain, setNewDomain] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDomains()
  }, [])

  const fetchDomains = async () => {
    try {
      const response = await fetch("/api/domains")
      if (response.ok) {
        const data = await response.json()
        setDomains(data.domains)
      }
    } catch (error) {
      console.error("Failed to fetch domains:", error)
    }
  }

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDomain) return

    setLoading(true)
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain }),
      })

      if (response.ok) {
        toast.success("Domain added successfully")
        setNewDomain("")
        fetchDomains()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to add domain")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm("Are you sure you want to remove this domain?")) return

    try {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Domain removed successfully")
        fetchDomains()
      } else {
        toast.error("Failed to remove domain")
      }
    } catch (error) {
      toast.error("An error occurred")
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddDomain} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="domain">Add New Domain</Label>
          <div className="flex gap-2">
            <Input
              id="domain"
              placeholder="example.com or https://example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a domain name or URL. Videos with domain restrictions can only be embedded on these domains.
          </p>
        </div>
      </form>

      <div className="space-y-2">
        <Label>Allowed Domains ({domains.length})</Label>
        {domains.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">No domains added yet</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {domains.map((domain) => (
              <Card key={domain.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{domain.domain}</span>
                    {domain.isActive && <Badge variant="secondary">Active</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteDomain(domain.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
