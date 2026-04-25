import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add RapidAPI CDN if necessary for any API responses that might include images
      // (Judge0 itself typically doesn't return images, but good practice if using other RapidAPI services)
      {
        protocol: 'https',
        hostname: '*.rapidapi.com', // Use wildcard for flexibility
        port: '',
        pathname: '/**',
      },
    ],        
  },
};

export default nextConfig;
