"use client"

import React from "react"
import Link from "next/link"
import { Check, Copy, ExternalLink } from "lucide-react"

const getOrigin = () => (typeof window === "undefined" ? "" : window.location.origin)

const toAbsoluteUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path
  const origin = getOrigin()
  return origin ? `${origin}${path.startsWith("/") ? path : `/${path}`}` : path
}

export function ApiBaseUrlCard() {
  const [copied, setCopied] = React.useState(false)
  const [apiBaseUrl, setApiBaseUrl] = React.useState("/api/plugin")

  React.useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    const origin = getOrigin()
    const isLocalEnv =
      envBase?.includes("localhost") ||
      envBase?.includes("127.0.0.1") ||
      envBase?.includes("[::1]")
    const base = envBase && !isLocalEnv ? envBase : origin

    setApiBaseUrl(base ? `${base}/api/plugin` : "/api/plugin")
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(apiBaseUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="mb-2 text-sm font-medium text-blue-700">API Base URL สำหรับ WordPress Plugin</p>
          <code className="inline-block rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-sm text-slate-700">
            {apiBaseUrl}
          </code>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50"
            onClick={copy}
            type="button"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
          <Link
            href="/api-docs"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4 text-slate-500" />
            API Docs
          </Link>
        </div>
      </div>
    </div>
  )
}

export function CopyEndpointButton({ path, id }: { path: string; id: string }) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const copy = async () => {
    await navigator.clipboard.writeText(toAbsoluteUrl(path))
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <button
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-100"
      onClick={copy}
      type="button"
      aria-label="Copy endpoint"
    >
      {copiedId === id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
    </button>
  )
}
