"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  Book,
  Code2,
  Copy,
  Check,
  ChevronRight,
  Key,
  Server,
  Zap,
  FileVideo,
  Upload,
  FolderOpen,
  Globe,
  Play,
  Terminal,
  Braces,
  Hash,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

interface Endpoint {
  method: HttpMethod
  path: string
  description: string
  params?: { name: string; type: string; required?: boolean; description: string }[]
  body?: { name: string; type: string; required?: boolean; description: string }[]
  response?: string
}

interface EndpointGroup {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  endpoints: Endpoint[]
}

const methodColors: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  GET: { bg: "bg-secondary", text: "text-secondary-foreground", border: "border-border" },
  POST: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  PUT: { bg: "bg-muted", text: "text-foreground", border: "border-border" },
  DELETE: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
}

const endpointGroups: EndpointGroup[] = [
  {
    id: "plugin",
    title: "Plugin Endpoints",
    description: "สำหรับ WordPress Plugin ดึงและซิงก์วิดีโอ",
    icon: <Zap className="h-5 w-5" />,
    endpoints: [
      {
        method: "GET",
        path: "/plugin/videos",
        description: "ดึงรายการวิดีโอทั้งหมดสำหรับ Plugin",
        params: [
          { name: "page", type: "number", description: "หน้าที่ต้องการ (default: 1)" },
          { name: "limit", type: "number", description: "จำนวนต่อหน้า (default: 20)" },
          { name: "category", type: "string", description: "กรองตาม category slug" },
        ],
        response: '{ "videos": [...], "total": 100, "page": 1 }',
      },
      {
        method: "GET",
        path: "/plugin/videos/:id",
        description: "ดึงข้อมูลวิดีโอตาม ID",
        params: [{ name: "id", type: "string", required: true, description: "Video ID" }],
        response: '{ "video": { "id": "...", "title": "...", ... } }',
      },
      {
        method: "POST",
        path: "/plugin/videos/sync",
        description: "ซิงก์ข้อมูลวิดีโอจาก WordPress",
        body: [
          { name: "videoIds", type: "string[]", required: true, description: "รายการ Video IDs ที่ต้องการซิงก์" },
        ],
        response: '{ "synced": 5, "failed": 0 }',
      },
    ],
  },
  {
    id: "videos",
    title: "Video Endpoints",
    description: "จัดการวิดีโอในระบบหลัก",
    icon: <FileVideo className="h-5 w-5" />,
    endpoints: [
      {
        method: "GET",
        path: "/videos",
        description: "ดึงรายการวิดีโอทั้งหมด",
        params: [
          { name: "page", type: "number", description: "หน้าที่ต้องการ" },
          { name: "limit", type: "number", description: "จำนวนต่อหน้า" },
          { name: "search", type: "string", description: "คำค้นหา" },
          { name: "category", type: "string", description: "กรองตาม category" },
          { name: "visibility", type: "string", description: "PUBLIC | PRIVATE | DOMAIN_RESTRICTED" },
        ],
        response: '{ "videos": [...], "total": 100 }',
      },
      {
        method: "POST",
        path: "/videos",
        description: "สร้างวิดีโอใหม่",
        body: [
          { name: "title", type: "string", required: true, description: "ชื่อวิดีโอ" },
          { name: "description", type: "string", description: "รายละเอียด" },
          { name: "videoUrl", type: "string", required: true, description: "URL ของไฟล์วิดีโอ" },
          { name: "thumbnailUrl", type: "string", description: "URL รูปหน้าปก" },
          { name: "tags", type: "string[]", description: "แท็ก" },
          { name: "categoryIds", type: "string[]", description: "รายการ Category IDs" },
          { name: "visibility", type: "string", description: "การเผยแพร่" },
        ],
        response: '{ "video": { "id": "...", ... } }',
      },
      {
        method: "GET",
        path: "/videos/:id",
        description: "ดึงข้อมูลวิดีโอตาม ID",
        params: [{ name: "id", type: "string", required: true, description: "Video ID" }],
        response: '{ "video": { ... } }',
      },
      {
        method: "PUT",
        path: "/videos/:id",
        description: "อัพเดทข้อมูลวิดีโอ",
        params: [{ name: "id", type: "string", required: true, description: "Video ID" }],
        body: [
          { name: "title", type: "string", description: "ชื่อวิดีโอ" },
          { name: "description", type: "string", description: "รายละเอียด" },
          { name: "tags", type: "string[]", description: "แท็ก" },
        ],
        response: '{ "video": { ... } }',
      },
      {
        method: "DELETE",
        path: "/videos/:id",
        description: "ลบวิดีโอ",
        params: [{ name: "id", type: "string", required: true, description: "Video ID" }],
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: "upload",
    title: "Upload Endpoints",
    description: "อัปโหลดไฟล์ขึ้น R2 Storage",
    icon: <Upload className="h-5 w-5" />,
    endpoints: [
      {
        method: "POST",
        path: "/upload-url",
        description: "ขอ Presigned URL สำหรับอัปโหลด",
        body: [
          { name: "filename", type: "string", required: true, description: "ชื่อไฟล์" },
          { name: "contentType", type: "string", required: true, description: "MIME type" },
          { name: "size", type: "number", required: true, description: "ขนาดไฟล์ (bytes)" },
          { name: "type", type: "string", required: true, description: "video | thumbnail" },
        ],
        response: '{ "uploadUrl": "...", "publicUrl": "..." }',
      },
      {
        method: "POST",
        path: "/upload-multipart",
        description: "เริ่ม Multipart Upload สำหรับไฟล์ใหญ่",
        body: [
          { name: "filename", type: "string", required: true, description: "ชื่อไฟล์" },
          { name: "contentType", type: "string", required: true, description: "MIME type" },
          { name: "parts", type: "number", required: true, description: "จำนวน parts" },
        ],
        response: '{ "uploadId": "...", "urls": [...] }',
      },
    ],
  },
  {
    id: "categories",
    title: "Category / Studio / Domain",
    description: "จัดการข้อมูลประกอบ",
    icon: <FolderOpen className="h-5 w-5" />,
    endpoints: [
      {
        method: "GET",
        path: "/categories",
        description: "ดึงรายการหมวดหมู่ทั้งหมด",
        response: '{ "categories": [...] }',
      },
      {
        method: "POST",
        path: "/categories",
        description: "สร้างหมวดหมู่ใหม่",
        body: [
          { name: "name", type: "string", required: true, description: "ชื่อหมวดหมู่" },
          { name: "slug", type: "string", required: true, description: "Slug URL" },
        ],
        response: '{ "category": { ... } }',
      },
      {
        method: "GET",
        path: "/studios",
        description: "ดึงรายการค่ายหนังทั้งหมด",
        response: '{ "studios": [...] }',
      },
      {
        method: "POST",
        path: "/studios",
        description: "สร้างค่ายหนังใหม่",
        body: [{ name: "name", type: "string", required: true, description: "ชื่อค่าย" }],
        response: '{ "studio": { ... } }',
      },
      {
        method: "DELETE",
        path: "/studios/:id",
        description: "ลบค่ายหนัง",
        params: [{ name: "id", type: "string", required: true, description: "Studio ID" }],
        response: '{ "success": true }',
      },
      {
        method: "GET",
        path: "/domains",
        description: "ดึงรายการโดเมนที่อนุญาต",
        response: '{ "domains": [...] }',
      },
      {
        method: "POST",
        path: "/domains",
        description: "เพิ่มโดเมนใหม่",
        body: [
          { name: "domain", type: "string", required: true, description: "ชื่อโดเมน" },
          { name: "isActive", type: "boolean", description: "สถานะการใช้งาน" },
        ],
        response: '{ "domain": { ... } }',
      },
      {
        method: "DELETE",
        path: "/domains/:id",
        description: "ลบโดเมน",
        params: [{ name: "id", type: "string", required: true, description: "Domain ID" }],
        response: '{ "success": true }',
      },
    ],
  },
]

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState("")
  const [token, setToken] = useState("")
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>("plugin")
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({})
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const base = envBase || origin
    if (base) setBaseUrl(`${base}/api`)
  }, [])

  // Filter endpoints based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return endpointGroups
    const query = searchQuery.toLowerCase()
    return endpointGroups
      .map((group) => ({
        ...group,
        endpoints: group.endpoints.filter(
          (ep) =>
            ep.path.toLowerCase().includes(query) ||
            ep.description.toLowerCase().includes(query) ||
            ep.method.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.endpoints.length > 0)
  }, [searchQuery])

  const handleSelectEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint)
    setParamValues({})
    setBodyValues({})
  }

  const buildUrl = (endpoint: Endpoint) => {
    let url = `${baseUrl}${endpoint.path}`
    // Replace path params
    endpoint.params?.forEach((param) => {
      if (endpoint.path.includes(`:${param.name}`)) {
        url = url.replace(`:${param.name}`, paramValues[param.name] || `:${param.name}`)
      }
    })
    // Add query params for GET requests
    if (endpoint.method === "GET" && endpoint.params) {
      const queryParams = endpoint.params
        .filter((p) => !endpoint.path.includes(`:${p.name}`) && paramValues[p.name])
        .map((p) => `${p.name}=${encodeURIComponent(paramValues[p.name])}`)
      if (queryParams.length > 0) {
        url += `?${queryParams.join("&")}`
      }
    }
    return url
  }

  const buildBody = () => {
    const body: Record<string, any> = {}
    selectedEndpoint?.body?.forEach((field) => {
      if (bodyValues[field.name]) {
        if (field.type === "number") {
          body[field.name] = Number(bodyValues[field.name])
        } else if (field.type === "boolean") {
          body[field.name] = bodyValues[field.name] === "true"
        } else if (field.type.includes("[]")) {
          body[field.name] = bodyValues[field.name].split(",").map((s) => s.trim())
        } else {
          body[field.name] = bodyValues[field.name]
        }
      }
    })
    return body
  }

  const generateCurl = () => {
    if (!selectedEndpoint) return ""
    const url = buildUrl(selectedEndpoint)
    let curl = `curl -X ${selectedEndpoint.method} "${url}"`
    if (token) {
      curl += ` \\\n  -H "Authorization: Bearer ${token}"`
    }
    if (selectedEndpoint.body && ["POST", "PUT"].includes(selectedEndpoint.method)) {
      curl += ` \\\n  -H "Content-Type: application/json"`
      const body = buildBody()
      if (Object.keys(body).length > 0) {
        curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`
      }
    }
    return curl
  }

  const generateJavaScript = () => {
    if (!selectedEndpoint) return ""
    const url = buildUrl(selectedEndpoint)
    const hasBody = selectedEndpoint.body && ["POST", "PUT"].includes(selectedEndpoint.method)
    const body = buildBody()

    let code = `const response = await fetch("${url}", {
  method: "${selectedEndpoint.method}",
  headers: {${token ? `\n    "Authorization": "Bearer ${token}",` : ""}${hasBody ? '\n    "Content-Type": "application/json",' : ""}
  },${hasBody && Object.keys(body).length > 0 ? `\n  body: JSON.stringify(${JSON.stringify(body, null, 4).split("\n").join("\n  ")}),` : ""}
});

const data = await response.json();
console.log(data);`
    return code
  }

  const generatePython = () => {
    if (!selectedEndpoint) return ""
    const url = buildUrl(selectedEndpoint)
    const hasBody = selectedEndpoint.body && ["POST", "PUT"].includes(selectedEndpoint.method)
    const body = buildBody()

    let code = `import requests

url = "${url}"
headers = {${token ? `\n    "Authorization": "Bearer ${token}",` : ""}${hasBody ? '\n    "Content-Type": "application/json",' : ""}
}
${hasBody && Object.keys(body).length > 0 ? `\ndata = ${JSON.stringify(body, null, 4)}\n` : ""}
response = requests.${selectedEndpoint.method.toLowerCase()}(url, headers=headers${hasBody && Object.keys(body).length > 0 ? ", json=data" : ""})
print(response.json())`
    return code
  }

  const copyToClipboard = async (code: string, type: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const currentGroup = endpointGroups.find((g) => g.id === selectedGroup)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/70 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-border/70 bg-muted/40">
                <Book className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">API Documentation</h1>
                <p className="text-sm text-muted-foreground">Media Storage API Reference</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/plugin">
                  <Zap className="h-4 w-4 mr-2" />
                  Plugin
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/admin/tokens">
                  <Key className="h-4 w-4 mr-2" />
                  API Tokens
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Config Section */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/70">
            <Label className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Base URL
            </Label>
            <div className="flex gap-2">
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-domain.com/api"
                className="bg-background font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(baseUrl, "baseUrl")}
              >
                {copiedCode === "baseUrl" ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/70">
            <Label className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
              <Key className="h-4 w-4" />
              Bearer Token
            </Label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ใส่ API Token เพื่อ generate code"
              className="bg-background font-mono text-sm"
            />
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา endpoint..."
              className="pl-10 bg-background placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Sidebar - Endpoint List */}
          <div className="lg:col-span-4 space-y-4">
            {/* Group Tabs */}
            <div className="flex flex-wrap gap-2 p-1 bg-muted/40 border border-border/70 rounded-xl">
              {endpointGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(group.id)}
                  className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedGroup === group.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {group.title.split(" ")[0]}
                </button>
              ))}
            </div>

            {/* Endpoints */}
            <div className="space-y-2">
              {(searchQuery ? filteredGroups : [currentGroup!])
                .filter(Boolean)
                .flatMap((group) =>
                  group.endpoints.map((endpoint) => {
                    const colors = methodColors[endpoint.method]
                    const isSelected =
                      selectedEndpoint?.path === endpoint.path && selectedEndpoint?.method === endpoint.method
                    return (
                      <button
                        key={`${endpoint.method}-${endpoint.path}`}
                        onClick={() => handleSelectEndpoint(endpoint)}
                        className={`w-full p-3 rounded-xl text-left transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary/30 border"
                            : "bg-muted/30 border border-border/70 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {endpoint.method}
                          </span>
                          <span className="font-mono text-sm text-foreground truncate">{endpoint.path}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-14">{endpoint.description}</p>
                      </button>
                    )
                  })
                )}
            </div>
          </div>

          {/* Main Content - Code Generator */}
          <div className="lg:col-span-8">
            {selectedEndpoint ? (
              <div className="space-y-6">
                {/* Endpoint Header */}
                <div className="p-6 rounded-2xl bg-muted/40 border border-border/70">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        methodColors[selectedEndpoint.method].bg
                      } ${methodColors[selectedEndpoint.method].text}`}
                    >
                      {selectedEndpoint.method}
                    </span>
                    <code className="text-lg font-mono text-foreground">{selectedEndpoint.path}</code>
                  </div>
                  <p className="text-muted-foreground">{selectedEndpoint.description}</p>
                </div>

                {/* Parameters */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border/70">
                    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                      <Hash className="h-4 w-4 text-primary" />
                      Parameters
                    </h3>
                    <div className="space-y-3">
                      {selectedEndpoint.params.map((param) => (
                        <div key={param.name} className="grid gap-2 sm:grid-cols-3 items-start">
                          <div className="flex items-center gap-2">
                            <code className="text-primary font-mono text-sm">{param.name}</code>
                            {param.required && (
                              <Badge className="bg-destructive/10 text-destructive text-xs">required</Badge>
                            )}
                          </div>
                          <Input
                            value={paramValues[param.name] || ""}
                            onChange={(e) =>
                              setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                            }
                            placeholder={param.type}
                            className="bg-background font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">{param.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {selectedEndpoint.body && selectedEndpoint.body.length > 0 && (
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border/70">
                    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                      <Braces className="h-4 w-4 text-primary" />
                      Request Body
                    </h3>
                    <div className="space-y-3">
                      {selectedEndpoint.body.map((field) => (
                        <div key={field.name} className="grid gap-2 sm:grid-cols-3 items-start">
                          <div className="flex items-center gap-2">
                            <code className="text-primary font-mono text-sm">{field.name}</code>
                            <span className="text-muted-foreground text-xs">{field.type}</span>
                            {field.required && (
                              <Badge className="bg-destructive/10 text-destructive text-xs">required</Badge>
                            )}
                          </div>
                          <Input
                            value={bodyValues[field.name] || ""}
                            onChange={(e) =>
                              setBodyValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            placeholder={field.type.includes("[]") ? "value1, value2" : field.type}
                            className="bg-background font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Code Output */}
                <div className="rounded-2xl bg-muted/40 border border-border/70 overflow-hidden">
                  <Tabs defaultValue="curl" className="w-full">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-background/60">
                      <TabsList className="bg-muted p-1">
                        <TabsTrigger
                          value="curl"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                          <Terminal className="h-4 w-4 mr-2" />
                          cURL
                        </TabsTrigger>
                        <TabsTrigger
                          value="javascript"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                          <Code2 className="h-4 w-4 mr-2" />
                          JavaScript
                        </TabsTrigger>
                        <TabsTrigger
                          value="python"
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground"
                        >
                          <Code2 className="h-4 w-4 mr-2" />
                          Python
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="curl" className="m-0">
                      <div className="relative">
                        <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground bg-muted">
                          {generateCurl()}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generateCurl(), "curl")}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {copiedCode === "curl" ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="javascript" className="m-0">
                      <div className="relative">
                        <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground bg-muted">
                          {generateJavaScript()}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generateJavaScript(), "js")}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {copiedCode === "js" ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="python" className="m-0">
                      <div className="relative">
                        <pre className="p-4 overflow-x-auto text-sm font-mono text-foreground bg-muted">
                          {generatePython()}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generatePython(), "python")}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          {copiedCode === "python" ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Response */}
                {selectedEndpoint.response && (
                  <div className="p-6 rounded-2xl bg-muted/40 border border-border/70">
                    <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Response Example
                    </h3>
                    <pre className="p-4 rounded-xl bg-muted text-sm font-mono text-foreground overflow-x-auto">
                      {selectedEndpoint.response}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Code2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">เลือก Endpoint</h3>
                <p className="text-muted-foreground max-w-sm">
                  คลิกที่ endpoint ทางซ้ายเพื่อดูรายละเอียด และ generate code สำหรับใช้งาน
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Link
            href="/plugin"
            className="group p-4 rounded-xl bg-muted/40 border border-border/70 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">WordPress Plugin</h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground">ดาวน์โหลด Plugin และ Theme</p>
          </Link>

          <Link
            href="/admin/tokens"
            className="group p-4 rounded-xl bg-muted/40 border border-border/70 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">API Tokens</h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground">สร้างและจัดการ API tokens</p>
          </Link>

          <Link
            href="/videos"
            className="group p-4 rounded-xl bg-muted/40 border border-border/70 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileVideo className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">จัดการวิดีโอ</h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground">ดูและจัดการวิดีโอทั้งหมด</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
