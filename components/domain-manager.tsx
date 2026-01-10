"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Globe, Pencil } from "lucide-react"
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
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null)
  const [editDomain, setEditDomain] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState("")

  useEffect(() => {
    fetchDomains()
  }, [])

  const formatDate = (value: string) => new Date(value).toLocaleString()

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

  const openEditDialog = (domain: Domain) => {
    setEditingDomain(domain)
    setEditDomain(domain.domain)
    setEditActive(domain.isActive)
    setEditError("")
  }

  const closeEditDialog = () => {
    if (saving) return
    setEditingDomain(null)
    setEditDomain("")
    setEditActive(true)
    setEditError("")
  }

  const handleUpdateDomain = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingDomain) return

    if (!editDomain.trim()) {
      setEditError("Domain is required.")
      return
    }

    setSaving(true)
    setEditError("")

    try {
      const response = await fetch(`/api/domains/${editingDomain.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: editDomain.trim(), isActive: editActive }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update domain")
      }

      toast.success("Domain updated successfully")
      closeEditDialog()
      fetchDomains()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update domain"
      setEditError(message)
      toast.error(message)
    } finally {
      setSaving(false)
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{domain.domain}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={domain.isActive ? "secondary" : "outline"}>
                          {domain.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(domain.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(domain)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteDomain(domain.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={Boolean(editingDomain)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit domain</DialogTitle>
            <DialogDescription>Update the domain name or change its active status.</DialogDescription>
          </DialogHeader>
          {editingDomain && (
            <form onSubmit={handleUpdateDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-domain">Domain</Label>
                <Input
                  id="edit-domain"
                  value={editDomain}
                  onChange={(event) => setEditDomain(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Allow embedding for this domain.</p>
                </div>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditDialog} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
