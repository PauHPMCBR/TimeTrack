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
};

export default nextConfig;
