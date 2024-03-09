/** @type {import('next').NextConfig} */
import 'dotenv/config';

const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  output: "standalone",
}

export default nextConfig
