import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, newContext } from './bot/browser.js';
import { emitInvoice, tinyAuthFile } from './bot/tiny.js';

const ROOT = process.cwd();
const ENTRADA = path.join(ROOT, 'entrada');
const PROCESSADOS = path.join(ROOT, 'processados');

fs.mkdirSync(ENTRADA, { recursive: true });
fs.mkdirSync(PROCESSADOS, { recursive: true });

const fila: string[] = [];
const naFila = new Set<string>();
let processando = false;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarArquivoEstavel(fullPath: string): Promise<boolean> {
  let tamanhoAnterior = -1;

  for (let tentativa = 0; tentativa < 15; tentativa++) {
    if (!fs.existsSync(fullPath)) return false;

    const tamanhoAtual = fs.statSync(fullPath).size;

    if (tamanhoAtual === tamanhoAnterior) return true;

    tamanhoAnterior = tamanhoAtual;
    await esperar(300);
  }

  return fs.existsSync(fullPath);
}

function adicionarFila(arquivo: string): void {
  if (!arquivo.toLowerCase().endsWith('.txt')) return;
  if (naFila.has(arquivo)) return;

  const fullPath = path.join(ENTRADA, arquivo);
  if (!fs.existsSync(fullPath)) return;

  naFila.add(arquivo);
  fila.push(arquivo);

  console.log(`Arquivo colocado na fila: ${arquivo}`);
  void processarFila();
}

async function processarArquivo(arquivo: string): Promise<void> {
  const fullPath = path.join(ENTRADA, arquivo);

  try {
    if (!fs.existsSync(fullPath)) return;

    console.log(`\nLendo arquivo: ${arquivo}`);

    const estavel = await esperarArquivoEstavel(fullPath);
    if (!estavel) {
      console.log(`Arquivo desapareceu antes do processamento: ${arquivo}`);
      return;
    }

    const pedidos = fs
      .readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    console.log(`Pedidos encontrados: ${pedidos.length}`);

    if (pedidos.length > 0) {
      const browser = await launchBrowser();
      console.log('Navegador do Tiny aberto.');

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
        console.log('Navegador do Tiny fechado.');
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
  }
}

async function processarFila(): Promise<void> {
  if (processando) return;

  processando = true;

  try {
    while (fila.length > 0) {
      const arquivo = fila.shift();
      if (!arquivo) continue;

      try {
        await processarArquivo(arquivo);
      } finally {
        naFila.delete(arquivo);
      }
    }
  } finally {
    processando = false;

    if (fila.length > 0) {
      void processarFila();
    }
  }
}

console.log('Monitorando pasta entrada...');
console.log(`Entrada: ${ENTRADA}`);
console.log(`Processados: ${PROCESSADOS}`);

// IMPORTANTE: recupera arquivos que já estavam em entrada antes do watcher iniciar.
// Isso evita a falha em que a GUI criava o TXT antes do fs.watch estar pronto.
for (const arquivo of fs.readdirSync(ENTRADA)) {
  adicionarFila(arquivo);
}

fs.watch(ENTRADA, (_, filename) => {
  if (!filename) return;

  const nome = filename.toString();
  if (!nome.toLowerCase().endsWith('.txt')) return;

  console.log(`\nNovo arquivo detectado: ${nome}`);
  adicionarFila(nome);
});
