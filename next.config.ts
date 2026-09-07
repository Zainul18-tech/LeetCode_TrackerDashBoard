/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        // Your VS Code dev tunnel host — update the subdomain if it
        // changes each time you start a new tunnel session.
        "k82zhpx0-3000.inc1.devtunnels.ms",
        // Broader wildcard so you don't have to edit this every time
        // devtunnels assigns a new random subdomain:
        "*.inc1.devtunnels.ms",
      ],
    },
  },
};

module.exports = nextConfig;