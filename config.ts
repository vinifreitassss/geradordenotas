import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  headless: false,
  tinyBaseUrl: 'https://erp.olist.com/',
  // Sempre aponta para a pasta auth do projeto, independentemente
  // de onde o comando foi executado.
  authDir: path.join(APP_ROOT, 'auth'),
};

export { APP_ROOT };
