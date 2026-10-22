import { loadServerConfig } from './config';
import { createServer } from './http/create-server';

const config = await loadServerConfig();
const server = createServer(config);

console.info(`Fin Assist is listening on ${server.url}`);
