import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext } from './bot/browser.js';
import { emitInvoice, tinyAuthFile } from './bot/tiny.js';

const ROOT = process.cwd();
const ENTRADA = path.join(ROOT, 'entrada');
const PROCESSADOS = path.join(ROOT, 'processados');

fs.mkdirSync(ENTRADA, { recursive: true });
fs.mkdirSync(PROCESSADOS, { recursive: true });

let processando = false;
const arquivosEmFila = new Set<string>();

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarArquivoEstavel(fullPath: string): Promise<boolean> {
  let tamanhoAnterior = -1;

  for (let tentativa = 0; tentativa < 10; tentativa++) {
    if (!fs.existsSync(fullPath)) return false;

    const tamanhoAtual = fs.statSync(fullPath).size;

    if (tamanhoAtual === tamanhoAnterior) return true;

    tamanhoAnterior = tamanhoAtual;
    await esperar(300);
  }

  return fs.existsSync(fullPath);
}

async function processarArquivo(arquivo: string): Promise<void> {
  if (processando || arquivosEmFila.has(arquivo)) return;

  arquivosEmFila.add(arquivo);
  processando = true;

  const fullPath = path.join(ENTRADA, arquivo);

  try {
    if (!fs.existsSync(fullPath)) return;

    console.log(`\nLendo arquivo: ${arquivo}`);

    const estavel = await esperarArquivoEstavel(fullPath);
    if (!estavel) return;

    const pedidos = fs
      .readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (pedidos.length === 0) {
      console.log('Arquivo vazio. Movendo para processados.');
    } else {
      console.log(`Pedidos encontrados: ${pedidos.length}`);

      const browser = await launchBrowser();
      const context = await newContext(browser, tinyAuthFile);

      try {
        for (const pedido of pedidos) {
          console.log('\n====================');
          console.log(`Processando: ${pedido}`);
          console.log('====================');

          try {
            await emitInvoice(context, pedido);
            console.log(`SUCESSO: ${pedido}`);
          } catch (error) {
            console.error(`ERRO no pedido ${pedido}:`);
            console.error(error);
          }
        }
      } finally {
        await context.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
      }
    }

    if (fs.existsSync(fullPath)) {
      const destino = path.join(PROCESSADOS, arquivo);
      const destinoFinal = fs.existsSync(destino)
        ? path.join(PROCESSADOS, `${Date.now()}_${arquivo}`)
        : destino;

      fs.renameSync(fullPath, destinoFinal);
      console.log(`Arquivo movido para processados: ${path.basename(destinoFinal)}`);
    }
  } catch (error) {
    console.error(`Erro ao processar ${arquivo}:`, error);
  } finally {
    arquivosEmFila.delete(arquivo);
    processando = false;
  }
}

console.log('Monitorando pasta entrada...');
console.log(`Entrada: ${ENTRADA}`);
console.log(`Processados: ${PROCESSADOS}`);

fs.watch(ENTRADA, (_, filename) => {
  if (!filename) return;

  const nome = filename.toString();
  if (!nome.toLowerCase().endsWith('.txt')) return;

  console.log(`\nNovo arquivo detectado: ${nome}`);
  void processarArquivo(nome);
});
