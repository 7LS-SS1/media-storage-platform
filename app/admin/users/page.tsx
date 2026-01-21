import { UserManager } from "@/components/user-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Users - Media Storage",
  description: "Manage users and roles",
}

export default function AdminUsersPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>จัดการผู้ใช้และกำหนดสิทธิ์ตาม Role</CardDescription>
          </CardHeader>
          <CardContent>
            <UserManager />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
