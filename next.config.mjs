/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/my-earnings.js",
        destination: "/my-earnings",
        permanent: false,
      },
      {
        source: "/my%20earnings",
        destination: "/my-earnings",
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
