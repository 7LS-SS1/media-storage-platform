"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Code, Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface EmbedCodeDialogProps {
  videoId: string
  videoTitle: string
}

export function EmbedCodeDialog({ videoId, videoTitle }: EmbedCodeDialogProps) {
  const [copied, setCopied] = useState(false)
  const [width, setWidth] = useState("640")
  const [height, setHeight] = useState("360")

  const embedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/embed/${videoId}`

  const embedCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allowfullscreen
  title="${videoTitle}">
</iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success("Embed code copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy embed code")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Code className="h-4 w-4 mr-2" />
          Get Embed Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Embed Video</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input id="width" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input id="height" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Embed Code</Label>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <iframe src={embedUrl} width="100%" height="100%" frameBorder="0" allowFullScreen title={videoTitle} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
