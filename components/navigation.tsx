"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { canManageDomains, canManageTokens, canManageUsers, canManageVideos } from "@/lib/roles"
import { Globe, KeyRound, Menu, Plug, UploadCloud, UserRound, Video } from "lucide-react"

type NavUser = {
  id: string
  email: string
  name: string | null
  role: string
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<NavUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const isEmbed = pathname.startsWith("/embed")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isEmbed) {
      setLoading(false)
      return
    }

    let active = true

    async function fetchUser() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" })
        if (!response.ok) {
          if (active) setUser(null)
          return
        }
        const data = await response.json()
        if (active) setUser(data.user)
      } catch (error) {
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchUser()

    return () => {
      active = false
    }
  }, [isEmbed])

  if (isEmbed) {
    return null
  }

  const initials = useMemo(() => {
    if (!user) return ""
    const source = user.name?.trim() || user.email
    const parts = source.split(" ").filter(Boolean)
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase()
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }, [user])

  const navLinks = [
    { href: "/videos", label: "Videos" },
    { href: "/plugin", label: "Plugin" },
    ...(user && canManageVideos(user.role) ? [{ href: "/videos/upload", label: "Upload" }] : []),
    ...(user && canManageUsers(user.role)
      ? [{ href: "/admin/users", label: "Users" }]
      : []),
    ...(user && canManageDomains(user.role)
      ? [
          { href: "/admin/domains", label: "Domains" },
        ]
      : []),
    ...(user && canManageTokens(user.role) ? [{ href: "/admin/tokens", label: "API Tokens" }] : []),
  ]

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Logout failed")
      }
      toast.success("Logged out")
      setUser(null)
      router.push("/login")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed"
      toast.error(message)
    }
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
              <Video className="h-5 w-5" />
            </span>
            <span className="text-base">Media Storage</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 p-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {navLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  {!user && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/login">Login</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" disabled>
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {user && canManageVideos(user.role) && (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/videos/upload">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload
                </Link>
              </Button>
            )}

            {loading ? (
              <div className="h-9 w-24 rounded-full bg-muted/70 animate-pulse" />
            ) : user ? (
              mounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="hidden flex-col items-start sm:flex">
                        <span className="text-sm font-medium leading-none">{user.name || "User"}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[220px]">
                    <DropdownMenuLabel className="space-y-2">
                      <div className="text-sm font-medium">{user.name || user.email}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{user.role}</Badge>
                        <span className="text-xs text-muted-foreground">Signed in</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/videos">
                        <Video className="h-4 w-4" />
                        Videos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/plugin">
                        <Plug className="h-4 w-4" />
                        Plugin
                      </Link>
                    </DropdownMenuItem>
                    {canManageVideos(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link href="/videos/upload">
                          <UploadCloud className="h-4 w-4" />
                          Upload
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canManageUsers(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin/users">
                          <UserRound className="h-4 w-4" />
                          Users
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canManageDomains(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin/domains">
                          <Globe className="h-4 w-4" />
                          Domains
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canManageTokens(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin/tokens">
                          <KeyRound className="h-4 w-4" />
                          API Tokens
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} variant="destructive">
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2" disabled>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden flex-col items-start sm:flex">
                    <span className="text-sm font-medium leading-none">{user.name || "User"}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </Button>
              )
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild className="hidden sm:inline-flex">
                  <Link href="/videos">Explore</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
