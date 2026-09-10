import type { NextConfig } from "next";

const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);
const isTauriProd = isTauri && process.env.TAURI_ENV_DEBUG !== "true";
const tauriDevHost = process.env.TAURI_DEV_HOST;

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

if (isTauriProd) {
  nextConfig.output = "export";
}

if (tauriDevHost) {
  nextConfig.assetPrefix = `http://${tauriDevHost}:3000`;
}

export default nextConfig;
