import { launchBrowser, newContext } from './bot/browser.js';
import { emitInvoice, tinyAuthFile } from './bot/tiny.js';

const pedidos = process.argv
  .slice(2)
  .map((x) => x.trim())
  .filter(Boolean);

if (pedidos.length === 0) {
  console.error('Uso: npx tsx src/test-tiny.ts PEDIDO1 PEDIDO2 PEDIDO3');
  process.exit(1);
}

async function main(): Promise<void> {
  const browser = await launchBrowser();
  const context = await newContext(browser, tinyAuthFile);

  try {
    console.log(`Testando ${pedidos.length} pedido(s)...`);

    for (const pedido of pedidos) {
      try {
        console.log(`\nTestando emissão para ${pedido}...`);
        await emitInvoice(context, pedido);
        console.log(`Fluxo concluído: ${pedido}`);
      } catch (error) {
        console.error(`Erro no pedido ${pedido}:`, error);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Erro no teste:', error);
  process.exit(1);
});
