import path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { config } from '../../config.js';
import { openPage } from './browser.js';

export const tinyAuthFile = path.join(config.authDir, 'tiny.json');

async function clickLoginIfNeeded(page: Page): Promise<void> {
  try {
    const loginBtn = page.getByRole('button', { name: /login/i });

    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Botão LOGIN detectado.');
      await loginBtn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      await page.waitForTimeout(1000);
    }
  } catch {
    // O botão Login é opcional no Tiny. Se não aparecer, seguimos normalmente.
  }
}

async function clickGerarNotas(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /^Gerar notas fiscais$/ });

  try {
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ timeout: 3000 });
    console.log('Gerar notas clicado.');
    return;
  } catch {}

  try {
    await btn.click({ force: true, timeout: 3000 });
    console.log('Gerar notas clicado (force).');
    return;
  } catch {}

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((el) =>
      (el.textContent || '').trim().includes('Gerar notas fiscais'),
    );

    if (!button) {
      throw new Error('Botão "Gerar notas fiscais" não encontrado');
    }

    (button as HTMLButtonElement).click();
  });

  console.log('Gerar notas clicado (JS fallback).');
}

async function fecharEmissao(page: Page): Promise<void> {
  console.log('Aguardando processamento do Tiny...');

  // Este delay é intencional: em alguns pedidos o Tiny ainda está processando
  // a geração quando o modal aparece. Remover pode fazer o bot fechar cedo demais.
  await page.waitForTimeout(1500);

  try {
    const modal = page.locator('.modal-content').last();
    const texto = await modal.textContent();

    console.log('\n===== RETORNO TINY =====');
    console.log(texto);
    console.log('========================\n');
  } catch {
    console.log('Não foi possível ler retorno do modal.');
  }

  const fechar = page.getByRole('button', {
    name: 'Fechar',
    exact: true,
  });

  await fechar.waitFor({ state: 'visible', timeout: 30000 });
  await fechar.click();
  console.log('Modal fechado.');

  await page.waitForTimeout(500);
}

export async function emitInvoice(
  context: BrowserContext,
  code: string,
): Promise<{ nfNumber: string | null }> {
  const page = await openPage(context, config.tinyBaseUrl);

  console.log(`Processando pedido ${code}`);

  await clickLoginIfNeeded(page);

  const campoBusca = page.getByRole('textbox', {
    name: /pesquise por cliente ou número/i,
  });

  await campoBusca.waitFor({ state: 'visible', timeout: 60000 });
  await campoBusca.fill(code);
  await page.waitForTimeout(250);
  await campoBusca.click();
  await page.waitForTimeout(500);

  await page.locator('#container-filtros').getByRole('button').click();
  await page.waitForTimeout(250);

  await page.getByRole('link', { name: 'Todos' }).click();
  await page.waitForTimeout(500);

  const checkbox = page.locator(
    '.checkbox-datatable > .comp-placeholder',
  ).first();

  await checkbox.waitFor({ state: 'visible', timeout: 10000 });
  await checkbox.click();

  console.log('Pedido marcado.');

  // Pequena margem para a tabela registrar a seleção, sem esperar os 3–5 s
  // que o fluxo anterior consumia antes de clicar em Gerar notas.
  await page.waitForTimeout(250);

  await clickGerarNotas(page);
  await fecharEmissao(page);

  console.log('Fluxo Tiny concluído.');

  return { nfNumber: null };
}
