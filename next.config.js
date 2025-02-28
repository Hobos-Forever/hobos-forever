const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    console.log("🔍 Webpack Config Loaded:", config);

    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "meta.cryptosquaries.com",
        pathname: "/images/composite/**",
      },
    ],
  },
};

module.exports = nextConfig;