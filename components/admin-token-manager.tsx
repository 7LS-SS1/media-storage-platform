"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { Copy, KeyRound, Pencil, RefreshCw } from "lucide-react"

const DEFAULT_EXPIRY_DAYS = 30
const MAX_EXPIRY_DAYS = 365

interface ApiTokenItem {
  id: string
  name: string
  last4: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export function AdminTokenManager() {
  const [tokenName, setTokenName] = useState("")
  const [expiresInDays, setExpiresInDays] = useState<string>(String(DEFAULT_EXPIRY_DAYS))
  const [token, setToken] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState("")
  const [tokens, setTokens] = useState<ApiTokenItem[]>([])
  const [editingToken, setEditingToken] = useState<ApiTokenItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editExpiresInDays, setEditExpiresInDays] = useState("")
  const [editError, setEditError] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  const formatDate = (value: string) => new Date(value).toLocaleString()

  const fetchTokens = async () => {
    setLoadingTokens(true)
    try {
      const response = await fetch("/api/admin/tokens", { credentials: "include" })
      if (response.status === 403) {
        setForbidden(true)
        return
      }
      if (!response.ok) {
        throw new Error("Failed to fetch tokens")
      }
      const data = await response.json()
      setTokens(data.tokens ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tokens"
      toast.error(message)
    } finally {
      setLoadingTokens(false)
    }
  }

  useEffect(() => {
    fetchTokens()
  }, [])

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    setForbidden(false)
    setToken("")
    setExpiresAt("")
    setLoading(true)

    try {
      if (!tokenName.trim()) {
        setError("Token name is required.")
        setLoading(false)
        return
      }

      const trimmed = expiresInDays.trim()
      let payload: { name: string; expiresInDays?: number } = { name: tokenName.trim() }

      if (trimmed) {
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setError("Expires in days must be a positive number.")
          setLoading(false)
          return
        }
        if (parsed > MAX_EXPIRY_DAYS) {
          setError(`Expires in days cannot exceed ${MAX_EXPIRY_DAYS}.`)
          setLoading(false)
          return
        }
        payload.expiresInDays = Math.floor(parsed)
      }

      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (response.status === 403) {
        setForbidden(true)
        throw new Error("Only system can generate API tokens.")
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate token")
      }

      setToken(result.token)
      setExpiresAt(result.apiToken?.expiresAt ?? "")
      setTokenName("")
      toast.success("API token generated")
      fetchTokens()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate token"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      toast.success("Token copied")
    } catch {
      toast.error("Failed to copy token")
    }
  }

  const openEditDialog = (tokenItem: ApiTokenItem) => {
    setEditingToken(tokenItem)
    setEditName(tokenItem.name)
    setEditExpiresInDays("")
    setEditError("")
  }

  const closeEditDialog = () => {
    if (savingEdit) return
    setEditingToken(null)
    setEditName("")
    setEditExpiresInDays("")
    setEditError("")
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingToken) return

    setEditError("")
    setSavingEdit(true)

    try {
      if (!editName.trim()) {
        setEditError("Name is required.")
        setSavingEdit(false)
        return
      }

      const payload: { name: string; expiresInDays?: number } = { name: editName.trim() }
      const trimmed = editExpiresInDays.trim()

      if (trimmed) {
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setEditError("Expires in days must be a positive number.")
          setSavingEdit(false)
          return
        }
        if (parsed > MAX_EXPIRY_DAYS) {
          setEditError(`Expires in days cannot exceed ${MAX_EXPIRY_DAYS}.`)
          setSavingEdit(false)
          return
        }
        payload.expiresInDays = Math.floor(parsed)
      }

      const response = await fetch(`/api/admin/tokens/${editingToken.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (response.status === 403) {
        setForbidden(true)
        throw new Error("Only system can update API tokens.")
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to update token")
      }

      toast.success("API token updated")
      closeEditDialog()
      fetchTokens()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update token"
      toast.error(message)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tokenName">ชื่อ Token</Label>
          <Input
            id="tokenName"
            placeholder="e.g. ส่วนกลางของแอปพลิเคชัน"
            value={tokenName}
            onChange={(event) => setTokenName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiresInDays">หมดอายุ</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="expiresInDays"
              type="number"
              min={1}
              max={MAX_EXPIRY_DAYS}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
              className="w-full sm:w-48"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Generate token
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Tokens นี้มีอายุการใช้งานสูงสุด {MAX_EXPIRY_DAYS} วัน. เว้นว่างเพื่อใช้ค่าพื้นฐานสูงสุด {DEFAULT_EXPIRY_DAYS} วัน.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>

      {forbidden && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            คุณไม่ได้รับสิทธิ์ในการสร้าง Token API.
          </CardContent>
        </Card>
      )}

      {token && (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="apiToken">API token</Label>
              <Textarea id="apiToken" value={token} readOnly className="font-mono text-sm" rows={4} />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy token
                </Button>
                {expiresAt && (
                  <span className="text-sm text-muted-foreground">Expires at: {new Date(expiresAt).toLocaleString()}</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Store this token securely. You can generate a new one at any time.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label>Existing tokens</Label>
        {loadingTokens ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">Loading tokens...</CardContent>
          </Card>
        ) : tokens.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">No tokens generated yet</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tokens.map((tokenItem) => {
              const isExpired =
                tokenItem.revokedAt !== null || new Date(tokenItem.expiresAt).getTime() <= Date.now()

              return (
                <Card key={tokenItem.id}>
                  <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tokenItem.name}</span>
                        <Badge variant={isExpired ? "outline" : "secondary"}>
                          {isExpired ? "Expired" : "Active"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">•••• {tokenItem.last4}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span>Created {formatDate(tokenItem.createdAt)}</span>
                        {" · "}
                        <span>Expires {formatDate(tokenItem.expiresAt)}</span>
                        {tokenItem.lastUsedAt && (
                          <>
                            {" · "}
                            <span>Last used {formatDate(tokenItem.lastUsedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(tokenItem)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editingToken)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API token</DialogTitle>
            <DialogDescription>Update the token name or extend its expiration.</DialogDescription>
          </DialogHeader>

          {editingToken && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editTokenName">Token name</Label>
                <Input
                  id="editTokenName"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editExpiresInDays">Extend by days (optional)</Label>
                <Input
                  id="editExpiresInDays"
                  type="number"
                  min={1}
                  max={MAX_EXPIRY_DAYS}
                  value={editExpiresInDays}
                  onChange={(event) => setEditExpiresInDays(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current expiry: {formatDate(editingToken.expiresAt)}
                </p>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditDialog} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
