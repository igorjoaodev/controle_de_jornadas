# Controle de Extras - CPR XIII

Sistema de Gestão Regional de Cotas e Escalas de Serviço Extraordinário da Polícia Militar do Pará — **Comando de Policiamento Regional XIII (CPR XIII)**.

🌐 **Acesso Online (GitHub Pages)**: [https://igorjoaodev.github.io/controle_de_jornadas/](https://igorjoaodev.github.io/controle_de_jornadas/)

---

## 🔒 Autenticação e Perfis de Acesso

O sistema conta com tela de login bloqueante e controle de permissões por perfil.

### Usuários Pré-configurados:

| Usuário (Login) | Senha Inicial | Perfil / Nível | Responsabilidades |
| :--- | :--- | :--- | :--- |
| `igor` | `igor123` | **DESENVOLVEDOR** (Administrador Geral) | Acesso irrestrito a todas as áreas, gestão de usuários (criar, redefinir senhas, inativar) e logs de auditoria. |
| `andreick` | `andreick123` | **USUÁRIO NORMAL** | Lançamento de escalas, acompanhamento de cotas, visualização de efetivo e exportação de relatórios CSV. |

> Qualquer usuário logado pode alterar sua própria senha pelo botão **🔑 Senha** na barra lateral.

---

## 🚀 Como Executar

### 1. Pelo Navegador (GitHub Pages)
Acesse diretamente: [https://igorjoaodev.github.io/controle_de_jornadas/](https://igorjoaodev.github.io/controle_de_jornadas/)
- Funciona 100% no navegador (Desktop, tablet ou celular).
- Armazenamento local com suporte a todas as operações, limites de escala, cotas e relatórios.

### 2. Localmente no Computador / Rede Interna (Servidor Python)
1. Instale o [Python 3.10+](https://www.python.org/downloads/) para Windows (marque "Add Python to PATH").
2. Dê um duplo clique no arquivo `INICIAR.bat`.
3. O sistema abrirá automaticamente no navegador em `http://localhost:8765`.
4. Os demais computadores da rede interna acessam pelo IP exibido no terminal (ex.: `http://192.168.x.x:8765`).

---

## 📋 Recursos Principais

- **Gestão de Cotas Regionais**: Cotas gerenciadas por operação e por mês sob a administração do CPR XIII.
- **Efetivo Organizado**: Visualização categorizada por graduação (Oficiais, Sargentos, Cabos e Soldados) nas unidades subordinadas (CPR XIII, 31ª CIPM, 17º BPM, 36º BPM).
- **Limite Mensal Automático**: Bloqueio automático de escala caso o militar já possua 12 extras no mês.
- **Relatórios e Auditoria**: Exportação de escalas em planilha CSV e registro de logs com identificação do usuário autenticado.

---

## 🛠️ Tecnologias

- **Backend**: Python 3 padrão (`http.server`, `sqlite3`, `hashlib`, `secrets`) — **sem dependências externas**.
- **Banco de Dados**: SQLite em modo WAL (com backup automático na inicialização).
- **Frontend**: HTML5, CSS3 moderno (design responsivo) e JavaScript nativo com modo híbrido (Servidor Python / GitHub Pages).

