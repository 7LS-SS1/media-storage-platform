import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Video, Upload, Shield, Search } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-balance">คลังสื่อ</h1>
            <p className="text-lg md:text-xl text-muted-foreground text-balance">
              คลังสื่อที่ปลอดภัยด้วยการควบคุมการเข้าถึงขั้นสูง ข้อจำกัดโดเมน และการฝังที่ราบรื่น
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/videos">วิดีโอ</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">ลงชื่อเข้าใช้</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">คุณสมบัติ</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Video className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">จัดการวิดีโอ</h3>
                <p className="text-sm text-muted-foreground">
                  เพิ่มวิดีโอใหม่ แก้ไขรายละเอียด และจัดระเบียบหมวดหมู่ของวิดีโอ
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Shield className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">ควบคุมการทำงาน</h3>
                <p className="text-sm text-muted-foreground">
                  สิทธิ์และข้อจำกัดโดเมนเพื่อการเข้าถึงที่ปลอดภัย
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Upload className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">R2 Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Powered by Cloudflare R2 for fast, reliable video delivery
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Search className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">ค้นหา / ตัวกรอง</h3>
                <p className="text-sm text-muted-foreground">ค้นหาวิดีโอได้อย่างรวดเร็วด้วยการค้นหาและตัวกรองที่ทรงพลัง</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
