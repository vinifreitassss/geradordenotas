import path from 'node:path';

export const config = {
  headless: false,
  tinyBaseUrl: 'https://erp.olist.com/',
  authDir: path.join(process.cwd(), 'auth'),
};
