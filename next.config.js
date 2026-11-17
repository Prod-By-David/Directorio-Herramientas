/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Codespaces sirve la app por un dominio *.app.github.dev: sin esto, Next bloquea
  // las acciones de servidor (login/envío) por "x-forwarded-host" distinto de "origin".
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
  allowedDevOrigins: ["*.app.github.dev"],
  images: {
    remotePatterns: [
      // {
      //   protocol: "https",
      //   hostname: "**",
      //   port: "",
      //   pathname: "**",
      // },
      // {
      //   protocol: "http",
      //   hostname: "**",
      //   port: "",
      //   pathname: "**",
      // },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/product-logos/**/**",
      },
    ],
  },
}

module.exports = nextConfig
