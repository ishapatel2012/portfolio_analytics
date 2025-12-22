const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "http://13.203.210.98",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
