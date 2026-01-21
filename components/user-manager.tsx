"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, Trash2, UserPlus } from "lucide-react"
import { isSystem } from "@/lib/roles"

interface UserItem {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  updatedAt: string
}

const ROLE_OPTIONS = [
  { value: "SYSTEM", label: "System" },
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
  { value: "VIEWER", label: "Viewer" },
]

const formatRole = (role: string) => (role === "EDITOR" ? "STAFF" : role)

export function UserManager() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("STAFF")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editRole, setEditRole] = useState("STAFF")
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState("")

  const canEditRoles = isSystem(currentRole)

  const availableRoles = useMemo(
    () => (canEditRoles ? ROLE_OPTIONS : ROLE_OPTIONS.filter((item) => item.value === "STAFF")),
    [canEditRoles],
  )

  useEffect(() => {
    let active = true
    async function fetchMe() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" })
        if (!response.ok) return
        const data = await response.json()
        if (active) {
          setCurrentRole(data.user?.role ?? null)
          if (!isSystem(data.user?.role)) {
            setRole("STAFF")
          }
        }
      } catch {
        if (active) setCurrentRole(null)
      }
    }
    fetchMe()
    return () => {
      active = false
    }
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    setForbidden(false)
    try {
      const response = await fetch("/api/admin/users", { credentials: "include" })
      if (response.status === 403) {
        setForbidden(true)
        return
      }
      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      setUsers(data.users ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch users"
      toast.error(message)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const resetCreateForm = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("STAFF")
    setCreateError("")
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError("")
    setForbidden(false)

    if (!email.trim()) {
      setCreateError("Email is required.")
      return
    }
    if (!password) {
      setCreateError("Password is required.")
      return
    }

    setCreating(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() ? name.trim() : undefined,
          password,
          role: canEditRoles ? role : "STAFF",
        }),
      })

      const result = await response.json()
      if (response.status === 403) {
        setForbidden(true)
        throw new Error("Not allowed to create user.")
      }
      if (!response.ok) {
        throw new Error(result.error || "Failed to create user")
      }

      toast.success("User created successfully")
      resetCreateForm()
      fetchUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create user"
      setCreateError(message)
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const openEditDialog = (user: UserItem) => {
    setEditingUser(user)
    setEditName(user.name ?? "")
    setEditEmail(user.email)
    setEditPassword("")
    setEditRole(formatRole(user.role))
    setEditError("")
  }

  const closeEditDialog = () => {
    if (savingEdit) return
    setEditingUser(null)
    setEditName("")
    setEditEmail("")
    setEditPassword("")
    setEditRole("STAFF")
    setEditError("")
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return

    setSavingEdit(true)
    setEditError("")

    try {
      const payload: Record<string, string> = {}
      if (editName.trim()) payload.name = editName.trim()
      if (editEmail.trim()) payload.email = editEmail.trim()
      if (editPassword) payload.password = editPassword
      if (canEditRoles && editRole !== formatRole(editingUser.role)) {
        payload.role = editRole
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (response.status === 403) {
        throw new Error("Not allowed to update user.")
      }
      if (!response.ok) {
        throw new Error(result.error || "Failed to update user")
      }

      toast.success("User updated successfully")
      closeEditDialog()
      fetchUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update user"
      setEditError(message)
      toast.error(message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user")
      }
      toast.success("User deleted successfully")
      fetchUsers()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user"
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="space-y-2">
          <Label>เพิ่มผู้ใช้ใหม่</Label>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="ชื่อ (optional)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="อีเมล"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Select value={role} onValueChange={setRole} disabled={!canEditRoles}>
              <SelectTrigger>
                <SelectValue placeholder="เลือก Role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={creating}>
              <UserPlus className="h-4 w-4 mr-2" />
              {creating ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
            </Button>
            {!canEditRoles && (
              <span className="text-xs text-muted-foreground">Admin สร้างได้เฉพาะ Staff</span>
            )}
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
        </div>
      </form>

      <div className="space-y-2">
        <Label>รายการผู้ใช้ ({users.length})</Label>
        {forbidden ? (
          <Card>
            <CardContent className="py-6 text-center text-destructive">
              คุณไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้
            </CardContent>
          </Card>
        ) : loadingUsers ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">Loading users...</CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">No users found</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatRole(user.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
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

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription>อัปเดตข้อมูลผู้ใช้และสิทธิ์การใช้งาน</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">ชื่อ</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">อีเมล</Label>
                <Input
                  id="edit-email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole} disabled={!canEditRoles}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canEditRoles && (
                  <p className="text-xs text-muted-foreground">Admin เปลี่ยน Role ได้เฉพาะ Staff</p>
                )}
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEditDialog} disabled={savingEdit}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  บันทึก
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
