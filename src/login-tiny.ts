import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext } from './bot/browser.js';
import { config } from '../config.js';

const authDir = config.authDir;
const authFile = path.join(authDir, 'tiny.json');
const loginUrl = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth?client_id=tiny-webapp&redirect_uri=https://erp.olist.com/login&scope=openid&response_type=code';

async function main(): Promise<void> {
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await newContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    console.log('Faça o login no Tiny na janela aberta.');
    console.log('Se aparecer o botão "login", clique nele.');
    console.log('Aguarde até entrar no ERP.');

    await page.waitForURL(/erp\.olist\.com|seller\.tiny\.com\.br/, {
      timeout: 180000,
    }).catch(() => undefined);

    const campoBusca = page.getByRole('textbox', {
      name: /pesquise por cliente ou número/i,
    });

    await campoBusca.waitFor({ state: 'visible', timeout: 180000 });

    await context.storageState({ path: authFile });
    console.log(`Login salvo em: ${authFile}`);
    console.log('Agora o watcher poderá reutilizar essa sessão.');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Erro ao salvar login:', error);
  process.exit(1);
});
