import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    // The @basis-theory/web-agentic dependency is a file: link to a
    // sibling checkout (../../web-agentic) until it is published to npm.
    // Widen the workspace root so Turbopack can resolve it.
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
