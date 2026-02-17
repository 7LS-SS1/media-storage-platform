"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, Package, Palette, ExternalLink, Key, ChevronRight, Check, Copy, Sparkles } from "lucide-react"

export default function PluginPage() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<number | null>(null)

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text)
    setCopiedEndpoint(id)
    setTimeout(() => setCopiedEndpoint(null), 2000)
  }

  const endpoints = [
    { method: "GET", path: "/videos", desc: "ดึงรายการวิดีโอทั้งหมด" },
    { method: "GET", path: "/videos/:id", desc: "ดึงข้อมูลวิดีโอตาม ID" },
    { method: "POST", path: "/videos/sync", desc: "ซิงค์ข้อมูลวิดีโอ" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-4">
            <Sparkles className="h-4 w-4" />
            Media Storage Integration
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent mb-3">
            Plugin & Theme Downloads
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            ดาวน์โหลดปลั๊กอินและธีมสำหรับเชื่อมต่อ WordPress กับระบบ Media Storage
          </p>
        </div>

        {/* Download Cards */}
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 max-w-6xl mx-auto mb-12">
          {/* Plugin Card */}
          <div className="group relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 opacity-20 blur-lg group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card Header with Gradient */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Package className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                    v2.0.1
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-1">Plugin WP</h2>
                <p className="text-blue-100 text-sm">ปลั๊กอิน WordPress สำหรับจัดการวิดีโอ</p>
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Download Button */}
                <a
                  href="/downloads/7ls-video-publisher-2.0.1.zip"
                  download
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:-translate-y-0.5 mb-6"
                >
                  <Download className="h-5 w-5" />
                  ดาวน์โหลด Plugin
                  <span className="text-blue-200 text-sm font-normal">(.zip)</span>
                </a>

                {/* File Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ไฟล์ปลั๊กอิน</p>
                    <p className="font-mono text-sm text-slate-700">7ls-video-publisher-2.0.1.zip</p>
                  </div>
                </div>

                {/* API Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    API Endpoints
                  </div>
                  
                  <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm">
                    <div className="text-slate-400 text-xs mb-3">Base URL: /api/plugin</div>
                    {endpoints.map((ep, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 group/item cursor-pointer hover:bg-slate-800/50 -mx-2 px-2 rounded"
                        onClick={() => copyToClipboard(ep.path, i)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            ep.method === "GET" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                          }`}>
                            {ep.method}
                          </span>
                          <span className="text-slate-300">{ep.path}</span>
                        </div>
                        {copiedEndpoint === i ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Auth Notice */}
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <Key className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-800 font-medium">ต้องใช้ Bearer Token</p>
                      <p className="text-amber-600 text-xs mt-0.5">ปลั๊กอินต้องส่ง Authorization header</p>
                    </div>
                  </div>

                  <Link
                    href="/admin/tokens"
                    className="flex items-center justify-center gap-2 w-full py-3 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium rounded-xl transition-colors"
                  >
                    <Key className="h-4 w-4" />
                    จัดการ API Tokens
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Card */}
          <div className="group relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 opacity-20 blur-lg group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card Header with Gradient */}
              <div className="bg-gradient-to-br from-violet-600 to-purple-700 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Palette className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                    v1.2.7
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-1">Theme WP</h2>
                <p className="text-violet-100 text-sm">ธีม WordPress สำหรับแสดงผลวิดีโอ</p>
              </div>

              {/* Card Body */}
              <div className="p-6">
                {/* Download Button */}
                <a
                  href="/downloads/publish-videos-api-1.2.7.zip"
                  download
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 transform hover:-translate-y-0.5 mb-6"
                >
                  <Download className="h-5 w-5" />
                  ดาวน์โหลด Theme
                  <span className="text-violet-200 text-sm font-normal">(.zip)</span>
                </a>

                {/* File Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-6">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Palette className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ไฟล์ธีม</p>
                    <p className="font-mono text-sm text-slate-700">publish-videos-api-1.2.7.zip</p>
                  </div>
                </div>

                {/* Installation Guide */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <div className="h-1 w-1 rounded-full bg-violet-500" />
                    วิธีติดตั้ง
                  </div>

                  <div className="space-y-3">
                    {[
                      { step: 1, text: "ดาวน์โหลดไฟล์ .zip ของธีม" },
                      { step: 2, text: "ไปที่ Appearance > Themes > Add New" },
                      { step: 3, text: "คลิก Upload Theme และเลือกไฟล์" },
                      { step: 4, text: "Activate ธีมและตั้งค่าเชื่อมต่อ Plugin" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-700 font-bold text-sm flex items-center justify-center">
                          {item.step}
                        </div>
                        <span className="text-sm text-slate-600">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Requirements Notice */}
                  <div className="flex items-start gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm">
                    <Package className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-violet-800 font-medium">ต้องติดตั้ง Plugin ก่อน</p>
                      <p className="text-violet-600 text-xs mt-0.5">ธีมนี้ทำงานร่วมกับ Plugin WP</p>
                    </div>
                  </div>

                  <Link
                    href="/videos"
                    className="flex items-center justify-center gap-2 w-full py-3 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700 hover:text-violet-700 font-medium rounded-xl transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    ไปหน้าจัดการวิดีโอ
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Theme AV Card */}
          <div className="group relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 opacity-20 blur-lg group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-br from-rose-600 to-orange-600 p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Palette className="h-7 w-7" />
                  </div>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                    AV Theme
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-1">Theme AV</h2>
                <p className="text-rose-100 text-sm">ธีม WordPress สำหรับเว็บไซต์สาย AV</p>
              </div>

              <div className="p-6">
                <a
                  href="/downloads/Theme-AV-api-20260217-173212.zip"
                  download
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all duration-300 transform hover:-translate-y-0.5 mb-6"
                >
                  <Download className="h-5 w-5" />
                  ดาวน์โหลด Theme AV
                  <span className="text-rose-200 text-sm font-normal">(.zip)</span>
                </a>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-6">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <Palette className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">ไฟล์ธีม AV</p>
                    <p className="font-mono text-sm text-slate-700">Theme-AV-api-20260217-173212.zip</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <div className="h-1 w-1 rounded-full bg-rose-500" />
                    วิธีติดตั้ง
                  </div>

                  <div className="space-y-3">
                    {[
                      { step: 1, text: "ดาวน์โหลดไฟล์ Theme AV (.zip)" },
                      { step: 2, text: "ไปที่ Appearance > Themes > Add New" },
                      { step: 3, text: "คลิก Upload Theme และเลือกไฟล์ Theme AV" },
                      { step: 4, text: "Activate ธีมและเชื่อมต่อ Plugin เวอร์ชันใหม่" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-bold text-sm flex items-center justify-center">
                          {item.step}
                        </div>
                        <span className="text-sm text-slate-600">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm">
                    <Package className="h-4 w-4 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-rose-800 font-medium">แนะนำใช้ Plugin v2.0.1</p>
                      <p className="text-rose-600 text-xs mt-0.5">เพื่อรองรับการทำงานล่าสุดของระบบ Media Storage</p>
                    </div>
                  </div>

                  <Link
                    href="/videos"
                    className="flex items-center justify-center gap-2 w-full py-3 border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-medium rounded-xl transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    ไปหน้าจัดการวิดีโอ
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 bg-white/10 rounded-xl">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">ต้องการ API Token?</h3>
                <p className="text-slate-400 text-sm">สร้างและจัดการ Token สำหรับเชื่อมต่อ API</p>
              </div>
            </div>
            <Link
              href="/admin/tokens"
              className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl transition-colors"
            >
              ไปที่หน้า API Tokens
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
