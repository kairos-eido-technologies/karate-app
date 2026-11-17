process.env.PORT = '3050';
process.env.NITRO_PORT = '3050';
process.env.HOST = '0.0.0.0';
process.env.NITRO_HOST = '0.0.0.0';

await import('./.output/server/index.mjs');
