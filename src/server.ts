import process from 'node:process';

import { startApplication as startApp } from './app-bootstrap';

const server = await startApp();

process.stdout.write(`Fin Assist is listening on ${server.url}\n`);
