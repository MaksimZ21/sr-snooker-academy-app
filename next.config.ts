import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const config: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@react-pdf/renderer", "canvas"],
};

export default withSerwist(config);
