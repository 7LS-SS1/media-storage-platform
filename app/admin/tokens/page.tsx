import { AdminTokenManager } from "@/components/admin-token-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "API Tokens - Media Storage",
  description: "Generate API tokens for admin access",
}

export default function AdminTokensPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>API Tokens</CardTitle>
            <CardDescription>สร้าง API Token สำหรับใช้งาน API Videos</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminTokenManager />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
