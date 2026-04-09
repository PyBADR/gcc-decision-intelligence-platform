import type { NextConfig } from "next";
import CopyPlugin from "copy-webpack-plugin";
import path from "path";

const cesiumSource = "node_modules/cesium/Build/Cesium";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["resium"],
  env: {
    CESIUM_BASE_URL: "/cesium",
  },
  webpack: (config, { isServer }) => {
    // Cesium requires special handling
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Copy Cesium static assets to public on client builds
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(cesiumSource, "Workers"),
              to: path.join("static", "cesium", "Workers"),
            },
            {
              from: path.join(cesiumSource, "ThirdParty"),
              to: path.join("static", "cesium", "ThirdParty"),
            },
            {
              from: path.join(cesiumSource, "Assets"),
              to: path.join("static", "cesium", "Assets"),
            },
            {
              from: path.join(cesiumSource, "Widgets"),
              to: path.join("static", "cesium", "Widgets"),
            },
          ],
        })
      );
    }

    return config;
  },
};

export default nextConfig;
