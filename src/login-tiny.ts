import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext } from './bot/browser.js';
import { config } from '../config.js';

const authDir = config.authDir;
const authFile = path.join(authDir, 'tiny.json');

const loginUrl =
  'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth?client_id=tiny-webapp&redirect_uri=https://erp.olist.com/login&scope=openid&response_type=code';

async function main(): Promise<void> {
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await launchBrowser();
  const context = await newContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
    });

    console.log('Faça o login no Tiny na janela aberta.');
    console.log('Se aparecer o botão "login", clique nele.');
    console.log('Aguarde até o ERP abrir completamente.');

    // O Tiny pode passar por mais de uma URL durante o login.
    // O ponto confiável é chegar ao domínio do ERP.
    await page.waitForURL(
      /erp\.olist\.com/,
      { timeout: 180000 }
    );

    console.log('Autenticação concluída.');
    console.log('Aguardando a sessão estabilizar...');

    // Pequena espera para que cookies/localStorage sejam gravados.
    await page.waitForTimeout(2500);

    // Salva a sessão ANTES de tentar localizar elementos da aplicação.
    // Isso evita perder o login caso o Tiny faça uma navegação/reload
    // adicional depois do redirecionamento.
    await context.storageState({
      path: authFile,
    });

    console.log(`Login salvo em: ${authFile}`);
    console.log('Sessão Tiny pronta para o watcher.');

    // Não dependemos mais do campo de busca para considerar o login salvo.
    // Apenas aguardamos um pouco para o usuário visualizar que terminou.
    await page.waitForTimeout(1000);
  } catch (error) {
    console.error('Erro durante o login/salvamento da sessão.');
    console.error(error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Erro ao salvar login:', error);
  process.exit(1);
});
