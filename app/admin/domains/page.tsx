import { DomainManager } from "@/components/domain-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Domain Management - Media Storage",
  description: "Manage allowed domains for video embedding",
}

export default function DomainsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Domain Management</CardTitle>
            <CardDescription>Manage domains that are allowed to embed domain-restricted videos</CardDescription>
          </CardHeader>
          <CardContent>
            <DomainManager />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
