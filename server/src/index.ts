import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { config } from './config.js';

const app = Fastify({
  logger: config.isDev
    ? { transport: { target: 'pino-pretty' } }
    : true,
});

await app.register(cors, {
  origin: config.isDev ? true : config.clientOrigin,
  credentials: true,
});

await app.register(cookie);

app.get('/health', async () => ({ status: 'ok', env: config.env }));

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Fortress server running on port ${config.port} [${config.env}]`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
