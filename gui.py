import customtkinter as ctk
from tkinter import filedialog
import subprocess
import threading
import shutil
import os
from datetime import datetime

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

ROOT = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(ROOT, "entrada")

os.makedirs(ENTRADA, exist_ok=True)

watcher_process = None


class App(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("EXPEDIÇÃO BOT V1")
        self.geometry("1100x700")
        self.minsize(850, 550)

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        titulo = ctk.CTkLabel(
            self,
            text="EXPEDIÇÃO BOT V1",
            font=("Arial", 28, "bold"),
        )
        titulo.grid(row=0, column=0, pady=20)

        self.textbox = ctk.CTkTextbox(self, height=180)
        self.textbox.grid(row=1, column=0, padx=20, sticky="ew")

        botoes = ctk.CTkFrame(self)
        botoes.grid(row=2, column=0, pady=15, padx=20, sticky="ew")

        ctk.CTkButton(
            botoes,
            text="Selecionar TXT",
            command=self.selecionar_txt,
        ).pack(side="left", padx=10, pady=10)

        self.btn_iniciar = ctk.CTkButton(
            botoes,
            text="INICIAR",
            fg_color="green",
            command=self.iniciar,
        )
        self.btn_iniciar.pack(side="left", padx=10, pady=10)

        ctk.CTkButton(
            botoes,
            text="PARAR",
            fg_color="red",
            command=self.parar,
        ).pack(side="left", padx=10, pady=10)

        self.status = ctk.CTkLabel(
            botoes,
            text="Watcher parado",
        )
        self.status.pack(side="right", padx=15)

        self.log = ctk.CTkTextbox(self)
        self.log.grid(row=3, column=0, padx=20, pady=20, sticky="nsew")

        self.escrever_log("Sistema iniciado.")
        self.escrever_log("Selecione um TXT com um pedido por linha e clique em INICIAR.")

        self.protocol("WM_DELETE_WINDOW", self.fechar)

    def escrever_log(self, msg):
        horario = datetime.now().strftime("%H:%M:%S")
        linha = f"[{horario}] {msg}\n"
        self.after(0, self._append_log, linha)

    def _append_log(self, linha):
        self.log.insert("end", linha)
        self.log.see("end")

    def selecionar_txt(self):
        arquivo = filedialog.askopenfilename(
            title="Selecione a lista de pedidos",
            filetypes=[("Arquivos TXT", "*.txt")],
        )

        if not arquivo:
            return

        try:
            with open(arquivo, "r", encoding="utf-8-sig") as f:
                conteudo = f.read()
        except UnicodeDecodeError:
            with open(arquivo, "r", encoding="latin-1") as f:
                conteudo = f.read()

        self.textbox.delete("1.0", "end")
        self.textbox.insert("1.0", conteudo)
        self.escrever_log(f"TXT carregado: {os.path.basename(arquivo)}")

    def localizar_npx(self):
        return shutil.which("npx.cmd") or shutil.which("npx")

    def iniciar_watcher(self):
        global watcher_process

        if watcher_process is not None and watcher_process.poll() is None:
            return True

        npx = self.localizar_npx()
        if not npx:
            self.escrever_log("ERRO: npx não encontrado. Instale o Node.js e reinicie o app.")
            return False

        try:
            watcher_process = subprocess.Popen(
                [npx, "tsx", "src/watcher.ts"],
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception as error:
            self.escrever_log(f"ERRO ao iniciar watcher: {error}")
            watcher_process = None
            return False

        self.status.configure(text="Watcher ativo")
        threading.Thread(target=self.ler_logs, daemon=True).start()
        return True

    def iniciar(self):
        pedidos = self.textbox.get("1.0", "end").strip()

        if not pedidos:
            self.escrever_log("Nenhum pedido informado.")
            return

        if not self.iniciar_watcher():
            return

        nome = datetime.now().strftime("pedidos_%Y%m%d_%H%M%S_%f.txt")
        destino = os.path.join(ENTRADA, nome)

        try:
            with open(destino, "w", encoding="utf-8") as f:
                f.write(pedidos + "\n")
        except Exception as error:
            self.escrever_log(f"ERRO ao criar lista: {error}")
            return

        quantidade = len([x for x in pedidos.splitlines() if x.strip()])
        self.escrever_log(f"Lista enviada para processamento: {quantidade} pedido(s).")
        self.escrever_log(f"Arquivo: {nome}")
        self.textbox.delete("1.0", "end")

    def ler_logs(self):
        global watcher_process

        processo = watcher_process
        if processo is None or processo.stdout is None:
            return

        try:
            for linha in processo.stdout:
                self.escrever_log(linha.rstrip())
        except Exception as error:
            self.escrever_log(f"Erro lendo log do watcher: {error}")

        codigo = processo.poll()
        if codigo is not None:
            self.escrever_log(f"Watcher encerrado. Código: {codigo}")
            self.after(0, lambda: self.status.configure(text="Watcher parado"))
            watcher_process = None

    def parar(self):
        global watcher_process

        if watcher_process is None:
            self.escrever_log("Watcher já está parado.")
            return

        if watcher_process.poll() is None:
            watcher_process.terminate()
            try:
                watcher_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                watcher_process.kill()

        watcher_process = None
        self.status.configure(text="Watcher parado")
        self.escrever_log("Watcher encerrado.")

    def fechar(self):
        self.parar()
        self.destroy()


if __name__ == "__main__":
    app = App()
    app.mainloop()
