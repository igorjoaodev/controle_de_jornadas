import os, shutil, sqlite3, tkinter as tk
from tkinter import filedialog, messagebox
BASE=os.path.dirname(os.path.abspath(__file__))
DEST=os.path.join(BASE,'controle_extras.db')
root=tk.Tk(); root.withdraw()
messagebox.showinfo('Migrar dados antigos','Selecione o arquivo controle_extras.db da pasta do sistema ANTIGO.\n\nFeche o sistema antigo e o novo antes de continuar. Não selecione um arquivo da pasta backups, a menos que seja intencional.')
src=filedialog.askopenfilename(title='Selecione o banco antigo (controle_extras.db)',filetypes=[('Banco SQLite','*.db'),('Todos os arquivos','*.*')])
if not src:
 messagebox.showwarning('Cancelado','Nenhum banco foi selecionado. Nenhum arquivo foi alterado.'); raise SystemExit
if os.path.abspath(src)==os.path.abspath(DEST):
 messagebox.showerror('Arquivo inválido','Você selecionou o banco que já está na pasta atual. Selecione o banco da versão antiga.'); raise SystemExit
try:
 c=sqlite3.connect(src); tables={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")};
 required={'units','personnel','operations','quotas','scales'}
 if not required.issubset(tables): raise ValueError('Esse arquivo não parece ser um banco válido do Controle de Extras. Faltam tabelas: '+', '.join(sorted(required-tables)))
 counts={t:c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in required}; c.close()
 detail='\n'.join(f'{t}: {counts[t]} registros' for t in ['units','personnel','operations','quotas','scales'])
 if not messagebox.askyesno('Confirmar migração','Banco encontrado:\n'+src+'\n\nConteúdo:\n'+detail+'\n\nO banco atual será guardado como backup e substituído pelos dados selecionados. Continuar?'): raise SystemExit
 if os.path.exists(DEST):
  backup=os.path.join(BASE,'controle_extras_antes_migracao.db')
  shutil.copy2(DEST,backup)
 shutil.copy2(src,DEST)
 # Limpa sidecars antigos para evitar WAL de outro banco sendo reaplicado
 for suffix in ('-wal','-shm'):
  side=DEST+suffix
  if os.path.exists(side): os.remove(side)
 messagebox.showinfo('Migração concluída','Os dados antigos foram copiados. Agora execute INICIAR.bat.\n\nSe necessário, o banco anterior está salvo como controle_extras_antes_migracao.db.')
except SystemExit: pass
except Exception as e: messagebox.showerror('Falha na migração',str(e)+'\n\nNenhuma alteração foi concluída com sucesso. Confira o arquivo selecionado.')
