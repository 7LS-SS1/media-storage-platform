import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  HardDrive,
  MoreVertical,
  Play,
  Plus,
  Settings,
  Upload,
  Video,
} from "lucide-react"
import { ApiBaseUrlCard, CopyEndpointButton } from "@/components/dashboard-copy-actions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RecentVideo = {
  id: string
  title: string
  duration: number | null
  views: number
  status: string
  createdAt: Date
  thumbnailUrl: string | null
}

const bytesToDisplay = (bytes: bigint | number | null | undefined) => {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes ?? 0
  if (!Number.isFinite(value) || value <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** unitIndex
  const digits = amount >= 100 || unitIndex === 0 ? 0 : amount >= 10 ? 1 : 2

  return `${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} ${units[unitIndex]}`
}

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds < 0) return "--:--"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

const formatRelativeDate = (date: Date) => {
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "เมื่อสักครู่"
  if (diffMs < hour) return `${Math.floor(diffMs / minute).toLocaleString("th-TH")} นาทีที่แล้ว`
  if (diffMs < day) return `${Math.floor(diffMs / hour).toLocaleString("th-TH")} ชั่วโมงที่แล้ว`
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day).toLocaleString("th-TH")} วันที่แล้ว`

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const getDashboardData = async () => {
  const [videoCount, viewsAggregate, storageAggregate, uniqueViewerCount, recentVideos] = await Promise.all([
    prisma.video.count(),
    prisma.video.aggregate({
      _sum: {
        views: true,
      },
    }),
    prisma.video.aggregate({
      _sum: {
        fileSize: true,
      },
      _count: {
        fileSize: true,
      },
    }),
    prisma.videoView.count(),
    prisma.video.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        title: true,
        duration: true,
        views: true,
        status: true,
        createdAt: true,
        thumbnailUrl: true,
      },
    }),
  ])

  return {
    stats: {
      totalVideos: videoCount,
      totalViews: viewsAggregate._sum.views ?? 0,
      uniqueViewers: uniqueViewerCount,
      storageUsed: storageAggregate._sum.fileSize ?? BigInt(0),
      videosWithSize: storageAggregate._count.fileSize,
    },
    recentVideos,
  }
}

const statusLabel = (status: string) => {
  if (status === "READY") return "เผยแพร่"
  if (status === "PROCESSING") return "กำลังประมวลผล"
  if (status === "FAILED") return "ล้มเหลว"
  return status
}

const statusClassName = (status: string) => {
  if (status === "READY") return "bg-green-100 text-green-700"
  if (status === "PROCESSING") return "bg-amber-100 text-amber-700"
  if (status === "FAILED") return "bg-red-100 text-red-700"
  return "bg-slate-100 text-slate-700"
}

export default async function DashboardPage() {
  const { stats, recentVideos } = await getDashboardData()

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="flex flex-col items-start gap-4 lg:flex-row">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">แดชบอร์ดคลังวิดีโอ</h1>
            <p className="mt-1 text-sm text-slate-500">
              ภาพรวมข้อมูลจริงจากฐานข้อมูลสำหรับวิดีโอ ผู้ชม และพื้นที่จัดเก็บ
            </p>
          </div>

          <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:w-auto">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">อัปโหลดวิดีโอใหม่</p>
                <p className="text-xs text-slate-500">เพิ่มไฟล์เข้าสู่คลังสื่อของคุณ</p>
              </div>
              <Link
                href="/videos/upload"
                className="ml-4 flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                อัปโหลด
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">วิดีโอทั้งหมด</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stats.totalVideos.toLocaleString("th-TH")}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <Video className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">ผู้ดูจริง</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {stats.uniqueViewers.toLocaleString("th-TH")}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              ยอดวิวรวม: {stats.totalViews.toLocaleString("th-TH")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">พื้นที่ใช้งานจริง</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{bytesToDisplay(stats.storageUsed)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
                <HardDrive className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-orange-500"
                style={{ width: stats.storageUsed > BigInt(0) ? "100%" : "0%" }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              จากวิดีโอที่มีขนาดไฟล์ {stats.videosWithSize.toLocaleString("th-TH")} รายการ
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">API Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
                  <p className="text-lg font-semibold text-green-600">Online</p>
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>
        </section>

        <ApiBaseUrlCard />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">วิดีโอล่าสุด</h2>
            <Link href="/videos" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              ดูทั้งหมด
            </Link>
          </div>

          {recentVideos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Video className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-900">ยังไม่มีวิดีโอในระบบ</p>
              <p className="mt-1 text-sm text-slate-500">เริ่มจากการอัปโหลดวิดีโอแรกของคุณ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVideos.map((video: RecentVideo) => (
                <div
                  key={video.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4 p-4">
                    <Link href={`/videos/${video.id}`} className="group relative flex-shrink-0">
                      <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-200 to-slate-300">
                        {video.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Video className="h-8 w-8 text-slate-400" />
                        )}
                      </div>
                      <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs text-white">
                        {formatDuration(video.duration)}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="h-8 w-8 text-white" fill="white" />
                      </div>
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link href={`/videos/${video.id}`} className="block truncate font-medium text-slate-900 hover:text-blue-700">
                        {video.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {video.views.toLocaleString("th-TH")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatRelativeDate(video.createdAt)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClassName(video.status)}`}>
                          {statusLabel(video.status)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <code className="max-w-xs truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                          /api/plugin/videos/{video.id}
                        </code>
                        <CopyEndpointButton path={`/api/plugin/videos/${video.id}`} id={video.id} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/videos/${video.id}/edit`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50"
                      >
                        แก้ไข
                      </Link>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100">
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-xl bg-slate-100 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">เครื่องมือที่เกี่ยวข้อง</h3>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <Link href="/videos" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 hover:bg-slate-50">
              <Video className="h-4 w-4 text-slate-500" />
              จัดการวิดีโอ
            </Link>
            <Link href="/api-docs" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 hover:bg-slate-50">
              <FileText className="h-4 w-4 text-slate-500" />
              API Docs
            </Link>
            <Link href="/admin/tokens" className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 hover:bg-slate-50">
              <Settings className="h-4 w-4 text-slate-500" />
              API Tokens
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
