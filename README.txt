CONTROLE DE EXTRAS - CPR XIII | VERSAO 1.5
================================================

AUTENTICAÇÃO E CONTROLE DE ACESSO
- Sistema totalmente bloqueado por tela de login e proteção de API.
- Criptografia de senhas com PBKDF2-SHA256 (Python nativo, sem dependências externas).
- Gerenciamento de sessões com tokens seguros e cookies HTTP-Only.
- Perfis de acesso diferenciados:
  * DESENVOLVEDOR / ADMINISTRADOR GERAL: Acesso irrestrito a todas as funções,
    incluindo painel de Usuários (criar usuários, redefinir senhas, alterar perfis)
    e Logs completos de alterações.
  * USUÁRIO NORMAL: Lançamentos de escalas, controle de cotas, visualização de efetivo
    e relatórios/exportação CSV.
- Qualquer usuário logado pode alterar sua própria senha pelo botão "🔑 Senha" na barra lateral.

USUÁRIOS INICIAIS PRÉ-CONFIGURADOS:
1. Administrador Geral / Desenvolvedor:
   - Usuário: igor
   - Nome: Igor João
   - Senha padrão: igor123
   - Perfil: Administrador Geral (Desenvolvedor)

2. Usuário Normal:
   - Usuário: andreick
   - Nome: Andreick
   - Senha padrão: andreick123
   - Perfil: Usuário Normal

RECURSOS DO SISTEMA
- Painel de cotas por operação e mês; quantidades editáveis na aba Operações e cotas.
- Efetivo organizado visualmente por graduação: oficiais, sargentos, cabos e soldados.
- Busca rápida por nome, unidade, operação e observações.
- Limite de 12 extras por policial por mês, somando todas as operações.
- Permite mais de uma extra para o mesmo policial no mesmo dia.
- Excluir lançamento de escala libera a cota.
- Logs de alterações registram data/hora, usuário logado, IP e máquina.
- Backup automático ao iniciar (mantém até 14 backups).

INSTALAÇÃO / EXECUÇÃO
1. Extraia toda a pasta no computador servidor.
2. Instale Python 3.13 ou mais recente para Windows (marque Add Python to PATH).
3. Execute INICIAR.bat e mantenha a janela aberta.
4. Os outros computadores acessam pelo endereço IPv4 exibido, terminando em :8765.
5. Se necessário, execute CONFIGURAR_REDE.bat como administrador no servidor.

ATUALIZAÇÃO SEM PERDER DADOS
- Pare o servidor antigo com CTRL+C.
- Faça uma cópia de segurança do controle_extras.db.
- Inicie INICIAR.bat.
