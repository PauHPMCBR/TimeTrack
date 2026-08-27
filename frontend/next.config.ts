import path from 'path';

const nextConfig: import('next').NextConfig = {
    turbopack: {
        root: path.join(__dirname, '..'),
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': __dirname,
        };
        return config;
    },
    transpilePackages: ['@registre-jornada/shared'],
    env: {
        NEXT_PUBLIC_BACKEND_URL:
            process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001',
    },
};

export default nextConfig;
