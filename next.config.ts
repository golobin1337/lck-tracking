import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Painel é todo dinâmico (dados por usuário via RLS); cacheComponents
  // exigiria Suspense em torno de todo acesso a cookies sem ganho real.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
