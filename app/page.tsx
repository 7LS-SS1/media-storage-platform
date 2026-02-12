"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Video,
  Upload,
  Copy,
  ExternalLink,
  HardDrive,
  Eye,
  Clock,
  Plus,
  Play,
  CheckCircle2,
  MoreVertical,
  Settings,
  FileText,
  Check,
} from "lucide-react";

export default function DashboardPreview() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("");

  React.useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const isLocalEnv =
      envBase?.includes("localhost") ||
      envBase?.includes("127.0.0.1") ||
      envBase?.includes("[::1]");
    const base = envBase && !isLocalEnv ? envBase : origin;
    if (base) {
      setApiBaseUrl(`${base}/api/plugin`);
    }
  }, []);

  const stats = {
    totalVideos: 24,
    totalViews: 12840,
    storageUsed: 4.2,
    storageLimit: 10,
  };

  const recentVideos = [
    {
      id: "vid_001",
      title: "แนะนำสินค้าใหม่ 2024",
      duration: "3:24",
      views: 1240,
      status: "active",
      createdAt: "2 ชั่วโมงที่แล้ว",
      endpoint: "https://api.media.example.com/v/vid_001",
    },
    {
      id: "vid_002",
      title: "วิธีการใช้งานแอปพลิเคชัน",
      duration: "8:15",
      views: 856,
      status: "active",
      createdAt: "1 วันที่แล้ว",
      endpoint: "https://api.media.example.com/v/vid_002",
    },
    {
      id: "vid_003",
      title: "Webinar: Digital Marketing 101",
      duration: "45:30",
      views: 2100,
      status: "active",
      createdAt: "3 วันที่แล้ว",
      endpoint: "https://api.media.example.com/v/vid_003",
    },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50">

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome + Quick Upload */}
        <section className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">
              สวัสดี, ผู้ดูแลระบบ 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              จัดการวิดีโอและสร้าง API Endpoint สำหรับ WordPress ของคุณ
            </p>
          </div>

          {/* Quick Upload Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm w-full lg:w-auto">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">
                  อัพโหลดวิดีโอใหม่
                </p>
                <p className="text-xs text-slate-500">
                  ลากไฟล์หรือคลิกเพื่อเลือก
                </p>
              </div>
              <button className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors">
                <Plus className="h-4 w-4" />
                อัพโหลด
              </button>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">วิดีโอทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.totalVideos}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Video className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">ยอดเข้าชมรวม</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.totalViews.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">พื้นที่ใช้งาน</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {stats.storageUsed} GB
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
              <div
                className="bg-orange-500 h-1.5 rounded-full"
                style={{
                  width: `${(stats.storageUsed / stats.storageLimit) * 100}%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats.storageLimit - stats.storageUsed} GB เหลืออยู่
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">API Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-lg font-semibold text-green-600">Online</p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>
        </section>

        {/* API Base URL */}
        <div className="border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700 mb-2">
                🔗 API Base URL สำหรับ WordPress Plugin
              </p>
              <code className="text-sm bg-white px-3 py-1.5 rounded-lg border border-blue-200 inline-block text-slate-700 font-mono">
                {apiBaseUrl || "/api/plugin"}
              </code>
            </div>
            <div className="flex gap-2">
              <button
                className="border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
                onClick={() => copyToClipboard(apiBaseUrl || "/api/plugin", "api")}
              >
                {copiedId === "api" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-500" />
                )}
                {copiedId === "api" ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
              <Link
                href="/api-docs"
                className="border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-slate-500" />
                API Docs
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Videos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              วิดีโอล่าสุด
            </h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              ดูทั้งหมด →
            </button>
          </div>

          <div className="space-y-3">
            {recentVideos.map((video) => (
              <div
                key={video.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 group cursor-pointer">
                    <div className="w-32 h-20 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg overflow-hidden flex items-center justify-center">
                      <Video className="h-8 w-8 text-slate-400" />
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                      {video.duration}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                      <Play className="h-8 w-8 text-white" fill="white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 truncate">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {video.views.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {video.createdAt}
                      </span>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        เผยแพร่
                      </span>
                    </div>

                    {/* Endpoint */}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 truncate max-w-xs font-mono">
                        {video.endpoint}
                      </code>
                      <button
                        className="h-6 w-6 flex items-center justify-center hover:bg-slate-100 rounded transition-colors flex-shrink-0"
                        onClick={() =>
                          copyToClipboard(video.endpoint, video.id)
                        }
                      >
                        {copiedId === video.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button className="border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                      แก้ไข
                    </button>
                    <button className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Tips */}
        <div className="bg-slate-100 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">
            💡 วิธีใช้งานกับ WordPress
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              1. ติดตั้ง Plugin "Media Library Connector" บน WordPress ของคุณ
            </p>
            <p>2. ไปที่ Settings → Media Library → ใส่ API URL และ API Key</p>
            <p>3. เลือกวิดีโอจากคลังนี้เพื่อ Embed ในโพสต์หรือหน้าของคุณ</p>
          </div>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-3">
            อ่านคู่มือฉบับเต็ม →
          </button>
        </div>
      </main>
    </div>
  );
}
