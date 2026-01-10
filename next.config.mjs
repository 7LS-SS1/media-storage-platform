/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    proxyClientMaxBodySize: "500gb",
  },
  serverExternalPackages: ["@prisma/client"],
  async rewrites() {
    return [
      {
        source: "/videos",
        has: [{ type: "header", key: "authorization", value: "Bearer (.*)" }],
        destination: "/api/plugin/videos",
      },
      {
        source: "/videos/:id",
        has: [{ type: "header", key: "authorization", value: "Bearer (.*)" }],
        destination: "/api/plugin/videos/:id",
      },
    ]
  },
}

export default nextConfig
