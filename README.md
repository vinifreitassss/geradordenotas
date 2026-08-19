# Gerador de Notas V1

Automação local para geração de notas fiscais no Tiny/Olist a partir de uma lista de pedidos.

## Arquitetura

- `src/bot/browser.ts`: abre o Chromium e cria o `BrowserContext`. Se `auth/tiny.json` existir, carrega a sessão salva.
- `src/bot/tiny.ts`: motor Playwright do Tiny. Pesquisa cada pedido, abre o filtro `Todos`, marca o pedido, clica em `Gerar notas fiscais` e aguarda a confirmação do Tiny.
- `src/watcher.ts`: monitora `entrada/`. Cada TXT contém um pedido por linha. Processa os pedidos em sequência e move o TXT para `processados/` ao terminar.
- `src/login-tiny.ts`: abre o login do Tiny e salva o estado da sessão em `auth/tiny.json`. O botão `login` opcional também é tratado pelo motor.
- `src/test-tiny.ts`: executa testes diretamente pela linha de comando, aceitando vários pedidos.
- `gui.py`: interface simples em CustomTkinter para o funcionário carregar uma lista TXT e iniciar o fluxo. A GUI inicia o watcher automaticamente e não implementa um segundo motor: ela apenas coloca o TXT em `entrada/`.
- `config.ts`: configura URL do Tiny, diretório da sessão e modo headless.

## Instalação

### Node.js

No diretório do projeto:

```bash
npm install
npx playwright install chromium
```

### Python

```bash
python -m pip install -r requirements.txt
```

## Primeiro login

Execute:

```bash
npm run login:tiny
```

Uma janela do Chromium será aberta. Faça o login manualmente. Se aparecer o botão `login`, clique nele. Quando a tela do ERP estiver carregada, o programa salva a sessão em `auth/tiny.json`.

Esse arquivo não deve ser enviado ao GitHub.

## Teste do motor

Um pedido:

```bash
npx tsx src/test-tiny.ts 260518Q5MKC4YK
```

Vários pedidos:

```bash
npx tsx src/test-tiny.ts 260518Q5MKC4YK 260514D6T982NX
```

## Uso normal

A forma recomendada é executar:

```bash
python gui.py
```

Na interface:

1. Selecione o TXT.
2. Confira os pedidos exibidos.
3. Clique em `INICIAR`.
4. O TXT é colocado em `entrada/`.
5. O watcher percebe o arquivo e executa os pedidos um por um.
6. O log da GUI mostra as ações e erros.
7. Ao terminar, o TXT é movido para `processados/`.

O TXT deve ter um código por linha, por exemplo:

```text
260518Q5MKC4YK
260514D6T982NX
2603048HSB8J01
```

## Observações importantes

A sessão do Tiny é local. Se o Tiny expirar a sessão ou exigir autenticação novamente, execute `npm run login:tiny` outra vez.

O delay de 1,5 segundo depois de `Gerar notas fiscais` é intencional. Ele evita fechar o retorno antes de o Tiny concluir a geração. O intervalo entre marcar o pedido e gerar a nota foi reduzido para cerca de 250 ms, mantendo apenas a margem necessária para a interface registrar a seleção.

Não coloque usuário, senha, `auth/tiny.json` ou outros segredos no repositório.
