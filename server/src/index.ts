import { config } from './config.js';
import { buildApp } from './app.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Fortress server running on port ${config.port} [${config.env}]`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
