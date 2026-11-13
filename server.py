#!/usr/bin/env python3
# Controle de Extras - CPR XIII | Python padrão + SQLite, sem dependências externas.
import http.server, socketserver, json, sqlite3, os, sys, socket, csv, io, threading, webbrowser, platform, hashlib, secrets
from urllib.parse import urlparse, parse_qs
from http.cookies import SimpleCookie
from datetime import date, datetime, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, 'controle_extras.db')
STATIC = BASE if os.path.exists(os.path.join(BASE, 'index.html')) else os.path.join(BASE, 'static')
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', '8765'))
DEFAULT_UNITS = ['CPR XIII', '31ª CIPM', '17º BPM', '36º BPM']
DEFAULT_OPS = ['OP. PMF', 'OP. ESC SEG', 'OP. MST', 'OP. GERAL CPR XIII']


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000)
    return key.hex(), salt


def verify_password(password, password_hash, salt):
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000)
    return secrets.compare_digest(key.hex(), password_hash)


def create_session(con, user_id, days=15):
    token = secrets.token_hex(32)
    expires = (datetime.now() + timedelta(days=days)).isoformat()
    con.execute('INSERT INTO sessions(token, user_id, expires_at) VALUES(?,?,?)', (token, user_id, expires))
    con.execute('UPDATE users SET last_login=? WHERE id=?', (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id))
    return token, expires


def connect():
    con = sqlite3.connect(DB_PATH, timeout=30, isolation_level='DEFERRED')
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA foreign_keys=ON')
    con.execute('PRAGMA busy_timeout=30000')
    con.execute('PRAGMA synchronous=NORMAL')
    con.execute('PRAGMA temp_store=MEMORY')
    con.execute('PRAGMA cache_size=-8000')
    return con


def backup_database():
    if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
        return
    folder = os.path.join(BASE, 'backups')
    os.makedirs(folder, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    target = os.path.join(folder, f'controle_extras_{stamp}.db')
    try:
        src = sqlite3.connect(DB_PATH, timeout=30)
        dst = sqlite3.connect(target)
        src.backup(dst)
        dst.close(); src.close()
        files = sorted((os.path.join(folder, x) for x in os.listdir(folder) if x.endswith('.db')), key=os.path.getmtime, reverse=True)
        for old in files[14:]:
            try: os.remove(old)
            except OSError: pass
        print(f' Backup automatico criado: {os.path.relpath(target, BASE)}')
    except Exception as exc:
        print(f' AVISO: backup automatico nao realizado: {exc}')


def init_db():
    if os.path.exists(DB_PATH):
        try:
            probe = sqlite3.connect(DB_PATH, timeout=30)
            probe.execute('PRAGMA journal_mode=WAL')
            probe.close()
        except sqlite3.Error as exc:
            print('Aviso ao configurar WAL:', exc)
    con = connect()
    con.executescript('''
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS personnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      unit TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, unit)
    );
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id INTEGER NOT NULL REFERENCES operations(id),
      month TEXT NOT NULL,
      total INTEGER NOT NULL CHECK(total >= 0),
      UNIQUE(operation_id, month)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      client_ip TEXT NOT NULL,
      machine TEXT NOT NULL,
      method TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_logs_created ON audit_logs(created_at DESC);
    CREATE TABLE IF NOT EXISTS scales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_id INTEGER NOT NULL REFERENCES personnel(id),
      operation_id INTEGER NOT NULL REFERENCES operations(id),
      scale_date TEXT NOT NULL,
      month TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Ativa',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scales_month ON scales(month);
    CREATE INDEX IF NOT EXISTS idx_scales_person_month ON scales(personnel_id, month);
    CREATE INDEX IF NOT EXISTS idx_scales_operation_month ON scales(operation_id, month);
    CREATE INDEX IF NOT EXISTS idx_scales_status_month ON scales(status, month);
    CREATE INDEX IF NOT EXISTS idx_scales_person_date_status ON scales(personnel_id, scale_date, status);
    ''')

    # Migração da coluna user_name em audit_logs caso a tabela já existisse
    try:
        cols = [r[1] for r in con.execute('PRAGMA table_info(audit_logs)').fetchall()]
        if 'user_name' not in cols:
            con.execute("ALTER TABLE audit_logs ADD COLUMN user_name TEXT NOT NULL DEFAULT ''")
    except Exception as exc:
        print('Aviso ao verificar colunas de audit_logs:', exc)

    # Criação dos usuários padrão se não existirem
    def ensure_user(uname, dname, pwd, role):
        existing = con.execute('SELECT id FROM users WHERE username=? COLLATE NOCASE', (uname,)).fetchone()
        if not existing:
            h, s = hash_password(pwd)
            con.execute('INSERT INTO users(username, display_name, password_hash, salt, role, active) VALUES(?,?,?,?,?,1)',
                        (uname, dname, h, s, role))

    ensure_user('igor', 'Igor João', 'igor123', 'admin')
    ensure_user('andreick', 'Andreick', 'andreick123', 'user')

    if con.execute('SELECT COUNT(*) FROM units').fetchone()[0] == 0:
        con.executemany('INSERT INTO units(name) VALUES(?)', [(x,) for x in DEFAULT_UNITS])
    if con.execute('SELECT COUNT(*) FROM operations').fetchone()[0] == 0:
        con.executemany('INSERT INTO operations(name) VALUES(?)', [(x,) for x in DEFAULT_OPS])

    aliases = {'POLÍCIA MAIS FORTE (PMF)':'OP. PMF', 'ESCOLTA/SEGURANÇA':'OP. ESC SEG', 'OPERAÇÃO MST':'OP. MST', 'OPERAÇÃO CPR XIII':'OP. GERAL CPR XIII'}
    for old,new in aliases.items():
        row=con.execute('SELECT id FROM operations WHERE name=?',(old,)).fetchone()
        if row and not con.execute('SELECT id FROM operations WHERE name=?',(new,)).fetchone(): con.execute('UPDATE operations SET name=? WHERE id=?',(new,row['id']))

    seed_path = os.path.join(BASE, 'seed_personnel.json')
    if con.execute('SELECT COUNT(*) FROM personnel').fetchone()[0] == 0 and os.path.exists(seed_path):
        try:
            with open(seed_path, encoding='utf-8') as f: people = json.load(f)
            for p in people:
                con.execute('INSERT OR IGNORE INTO personnel(name,unit,active) VALUES(?,?,1)', (p['name'],p['unit']))
        except Exception as e: print('Aviso: não foi possível importar efetivo inicial:', e)

    # Limpeza de sessões expiradas
    try:
        con.execute('DELETE FROM sessions WHERE expires_at < ?', (datetime.now().isoformat(),))
    except: pass

    con.commit(); con.close()


def month_of(d): return d[:7]
def as_dict(row): return dict(row) if row else None


def dashboard(con, month):
    people = con.execute('SELECT COUNT(*) n FROM personnel WHERE active=1').fetchone()['n']
    active_scales = con.execute("SELECT COUNT(*) n FROM scales WHERE month=? AND status!='Cancelada'", (month,)).fetchone()['n']
    qrows = con.execute('''SELECT o.id operation_id,o.name,COALESCE(q.total,0) total,
      SUM(CASE WHEN s.id IS NOT NULL AND s.status!='Cancelada' THEN 1 ELSE 0 END) used
      FROM operations o LEFT JOIN quotas q ON q.operation_id=o.id AND q.month=?
      LEFT JOIN scales s ON s.operation_id=o.id AND s.month=?
      WHERE o.active=1 GROUP BY o.id,o.name,q.total ORDER BY o.name''', (month,month)).fetchall()
    quotas=[]
    for r in qrows:
        d=dict(r); d['used']=int(d['used'] or 0); d['remaining']=d['total']-d['used']; d['over']=max(0,-d['remaining']); quotas.append(d)
    p_rows=con.execute('''SELECT p.id,p.name,p.unit,COUNT(s.id) used FROM personnel p
      LEFT JOIN scales s ON s.personnel_id=p.id AND s.month=? AND s.status!='Cancelada'
      WHERE p.active=1 GROUP BY p.id ORDER BY p.name''',(month,)).fetchall()
    people_stats=[]
    for r in p_rows:
        d=dict(r); d['used']=int(d['used']); d['remaining']=max(0,12-d['used']); d['blocked']=d['used']>=12
        people_stats.append(d)
    remaining_total=sum(max(0,x['remaining']) for x in quotas)
    over_total=sum(x['over'] for x in quotas)
    today=date.today(); lastday=(date(today.year+1,1,1) if today.month==12 else date(today.year,today.month+1,1))
    days_left=(lastday-today).days if month==today.strftime('%Y-%m') else None
    return {'month':month,'people_count':people,'scale_count':active_scales,'quotas':quotas,
            'people':people_stats,'days_left':days_left,'quota_remaining':remaining_total,'quota_over':over_total}


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'ControleExtrasCPRXIII/1.5'

    def log_message(self, fmt, *args):
        if self.path.startswith('/api/') and self.command == 'GET':
            return
        print('%s - %s' % (self.address_string(), fmt % args))

    def send_bytes(self, data, ctype='application/json; charset=utf-8', status=200, extra_headers=None):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if extra_headers:
            for k,v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def json(self, obj, status=200, extra_headers=None):
        if status < 400 and self.command in ('POST','PATCH','DELETE') and urlparse(self.path).path.startswith('/api/'):
            # Ignora log de alteração para login e logout
            cur_path = urlparse(self.path).path
            if cur_path not in ('/api/auth/login', '/api/auth/logout'):
                try:
                    con = connect()
                    client_ip = self.client_address[0]
                    machine = str(self.headers.get('X-Client-Machine',''))[:120] or 'Não informado pelo navegador'
                    action = f'{self.command} {cur_path}'
                    details = json.dumps(getattr(self,'_audit_data',{}), ensure_ascii=False)[:1500]
                    cur_u = getattr(self, '_current_user', None)
                    user_name = cur_u['display_name'] if cur_u else 'Não identificado'
                    con.execute('INSERT INTO audit_logs(client_ip,machine,method,action,details,user_name) VALUES(?,?,?,?,?,?)',
                                (client_ip, machine, self.command, action, details, user_name))
                    con.commit()
                    con.close()
                except Exception as exc:
                    print('Aviso: falha ao gravar log:', exc)
        self.send_bytes(json.dumps(obj, ensure_ascii=False).encode('utf-8'), status=status, extra_headers=extra_headers)

    def body(self):
        n = int(self.headers.get('Content-Length','0') or 0)
        if n > 2_000_000:
            raise ValueError('Requisição muito grande.')
        raw = self.rfile.read(n) if n else b'{}'
        return json.loads(raw.decode('utf-8'))

    def get_current_user(self):
        token = None
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            token = auth[7:].strip()
        if not token:
            cookie_h = self.headers.get('Cookie', '')
            if cookie_h:
                try:
                    c = SimpleCookie()
                    c.load(cookie_h)
                    if 'cpr_session' in c:
                        token = c['cpr_session'].value
                except Exception:
                    pass
        if not token:
            return None
        con = connect()
        try:
            now = datetime.now().isoformat()
            row = con.execute('''
                SELECT u.id, u.username, u.display_name, u.role, u.active, s.expires_at, s.token
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = ? AND s.expires_at > ? AND u.active = 1
            ''', (token, now)).fetchone()
            return dict(row) if row else None
        finally:
            con.close()

    def do_GET(self):
        u = urlparse(self.path); path = u.path; qs = parse_qs(u.query)
        if path.startswith('/api/'):
            if path == '/api/health':
                self.json({'ok': True, 'database': os.path.basename(DB_PATH)})
                return
            if path == '/api/auth/me':
                cur = self.get_current_user()
                if cur:
                    self.json({'authenticated': True, 'user': {'id': cur['id'], 'username': cur['username'], 'display_name': cur['display_name'], 'role': cur['role']}})
                else:
                    self.json({'authenticated': False})
                return

            # Demais rotas /api/ exigem autenticação
            user = self.get_current_user()
            if not user:
                if path == '/api/export.csv':
                    self.send_bytes(b'Acesso nao autorizado. Faca login no sistema.', 'text/plain; charset=utf-8', 401)
                else:
                    self.json({'error': 'Não autenticado. Faça login no sistema.', 'auth_required': True}, 401)
                return
            self._current_user = user

            con = connect()
            try:
                month = qs.get('month', [date.today().strftime('%Y-%m')])[0]
                if path == '/api/auth/users':
                    if user['role'] != 'admin':
                        return self.json({'error': 'Acesso negado. Apenas o Administrador Geral pode visualizar os usuários.'}, 403)
                    rows = con.execute('SELECT id, username, display_name, role, active, created_at, last_login FROM users ORDER BY display_name').fetchall()
                    self.json([dict(x) for x in rows])
                elif path == '/api/init':
                    self.json({
                        'units': [x['name'] for x in con.execute('SELECT name FROM units WHERE active=1 ORDER BY name')],
                        'unit_records': [dict(x) for x in con.execute('SELECT * FROM units ORDER BY name')],
                        'month': month,
                        'dashboard': dashboard(con, month),
                        'personnel': [dict(x) for x in con.execute('SELECT * FROM personnel ORDER BY unit,name')],
                        'operations': [dict(x) for x in con.execute('SELECT * FROM operations ORDER BY name')],
                        'scales': [dict(x) for x in con.execute('''SELECT s.*,p.name person_name,p.unit,o.name operation_name FROM scales s JOIN personnel p ON p.id=s.personnel_id JOIN operations o ON o.id=s.operation_id WHERE s.month=? ORDER BY s.scale_date DESC,s.id DESC''', (month,))],
                        'user': {'id': user['id'], 'username': user['username'], 'display_name': user['display_name'], 'role': user['role']}
                    })
                elif path == '/api/dashboard': self.json(dashboard(con, month))
                elif path == '/api/personnel': self.json([dict(x) for x in con.execute('SELECT * FROM personnel ORDER BY unit,name')])
                elif path == '/api/operations': self.json([dict(x) for x in con.execute('SELECT * FROM operations ORDER BY name')])
                elif path == '/api/units': self.json([dict(x) for x in con.execute('SELECT * FROM units ORDER BY name')])
                elif path == '/api/scales':
                    self.json([dict(x) for x in con.execute('''SELECT s.*,p.name person_name,p.unit,o.name operation_name FROM scales s JOIN personnel p ON p.id=s.personnel_id JOIN operations o ON o.id=s.operation_id WHERE s.month=? ORDER BY s.scale_date DESC,s.id DESC''', (month,))])
                elif path == '/api/export.csv':
                    rows = con.execute('''SELECT s.scale_date,s.month,p.name,p.unit,o.name operation,s.status,s.notes FROM scales s JOIN personnel p ON p.id=s.personnel_id JOIN operations o ON o.id=s.operation_id WHERE s.month=? ORDER BY s.scale_date,p.name''', (month,)).fetchall()
                    out = io.StringIO(); w = csv.writer(out, delimiter=';'); w.writerow(['Data','Mês','Policial','Unidade de origem','Operação','Situação','Observações'])
                    for r in rows: w.writerow(list(r))
                    self.send_bytes(('\ufeff' + out.getvalue()).encode('utf-8'), 'text/csv; charset=utf-8', 200, {'Content-Disposition': f'attachment; filename="extras_{month}.csv"'})
                elif path == '/api/logs':
                    if user['role'] != 'admin':
                        return self.json({'error': 'Acesso negado. Apenas o Administrador Geral pode visualizar os logs.'}, 403)
                    rows = con.execute('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 1000').fetchall()
                    self.json([dict(x) for x in rows])
                else: self.json({'error': 'Endpoint não encontrado.'}, 404)
            finally: con.close()
            return

        if path == '/' or path == '/index.html':
            try:
                with open(os.path.join(STATIC, 'index.html'), 'rb') as f: data = f.read()
                self.send_bytes(data, 'text/html; charset=utf-8')
            except FileNotFoundError: self.send_bytes(b'Arquivo da interface nao encontrado.', 'text/plain', 500)
            return

        filename = os.path.basename(path)
        if filename in ('app.js', 'style.css'):
            typ = 'application/javascript; charset=utf-8' if filename.endswith('.js') else 'text/css; charset=utf-8'
            try:
                with open(os.path.join(STATIC, filename), 'rb') as f: self.send_bytes(f.read(), typ)
            except FileNotFoundError: self.send_bytes(b'Arquivo nao encontrado.', 'text/plain', 404)
            return

        self.send_bytes(b'Not found', 'text/plain', 404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self.body()
            self._audit_data = data
        except Exception as e:
            return self.json({'error': str(e)}, 400)

        # Login público
        if path == '/api/auth/login':
            username = str(data.get('username', '')).strip()
            password = str(data.get('password', ''))
            if not username or not password:
                return self.json({'error': 'Informe o usuário e a senha.'}, 400)
            con = connect()
            try:
                row = con.execute('SELECT * FROM users WHERE (username=? OR display_name=? COLLATE NOCASE) AND active=1', (username, username)).fetchone()
                if not row or not verify_password(password, row['password_hash'], row['salt']):
                    return self.json({'error': 'Usuário ou senha incorretos.'}, 401)
                token, expires = create_session(con, row['id'])
                con.commit()
                cookie_header = f'cpr_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1296000'
                resp_payload = {
                    'ok': True,
                    'token': token,
                    'user': {
                        'id': row['id'],
                        'username': row['username'],
                        'display_name': row['display_name'],
                        'role': row['role']
                    }
                }
                self.send_bytes(json.dumps(resp_payload, ensure_ascii=False).encode('utf-8'),
                                ctype='application/json; charset=utf-8',
                                status=200,
                                extra_headers={'Set-Cookie': cookie_header})
                return
            finally:
                con.close()

        # Demais endpoints de POST exigem autenticação
        user = self.get_current_user()
        if not user:
            return self.json({'error': 'Não autenticado. Faça login no sistema.', 'auth_required': True}, 401)
        self._current_user = user

        if path == '/api/auth/logout':
            con = connect()
            try:
                if 'token' in user:
                    con.execute('DELETE FROM sessions WHERE token=?', (user['token'],))
                    con.commit()
            finally:
                con.close()
            cookie_clear = 'cpr_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0'
            self.send_bytes(json.dumps({'ok': True}).encode('utf-8'),
                            ctype='application/json; charset=utf-8',
                            status=200,
                            extra_headers={'Set-Cookie': cookie_clear})
            return

        if path == '/api/auth/change-password':
            cur_pwd = str(data.get('current_password', ''))
            new_pwd = str(data.get('new_password', ''))
            if len(new_pwd) < 4:
                return self.json({'error': 'A nova senha deve ter no mínimo 4 caracteres.'}, 400)
            con = connect()
            try:
                row = con.execute('SELECT * FROM users WHERE id=?', (user['id'],)).fetchone()
                if not row or not verify_password(cur_pwd, row['password_hash'], row['salt']):
                    return self.json({'error': 'Senha atual incorreta.'}, 400)
                h, s = hash_password(new_pwd)
                con.execute('UPDATE users SET password_hash=?, salt=? WHERE id=?', (h, s, user['id']))
                con.commit()
                return self.json({'ok': True, 'message': 'Senha alterada com sucesso.'})
            finally:
                con.close()

        if path == '/api/auth/users':
            if user['role'] != 'admin':
                return self.json({'error': 'Acesso negado. Apenas o Administrador Geral pode cadastrar usuários.'}, 403)
            new_uname = str(data.get('username', '')).strip().lower()
            new_dname = str(data.get('display_name', '')).strip()
            new_pwd = str(data.get('password', ''))
            new_role = 'admin' if data.get('role') == 'admin' else 'user'
            if not new_uname or not new_dname or len(new_pwd) < 4:
                return self.json({'error': 'Preencha nome, usuário e senha com no mínimo 4 caracteres.'}, 400)
            con = connect()
            try:
                h, s = hash_password(new_pwd)
                try:
                    cur = con.execute('INSERT INTO users(username, display_name, password_hash, salt, role, active) VALUES(?,?,?,?,?,1)',
                                      (new_uname, new_dname, h, s, new_role))
                    con.commit()
                    return self.json({'ok': True, 'id': cur.lastrowid})
                except sqlite3.IntegrityError:
                    return self.json({'error': 'Já existe um usuário com esse login.'}, 409)
            finally:
                con.close()

        con = connect()
        try:
            if path == '/api/personnel':
                name = str(data.get('name','')).strip(); unit = str(data.get('unit','')).strip()
                if not name or not con.execute('SELECT id FROM units WHERE name=? AND active=1',(unit,)).fetchone():
                    return self.json({'error':'Informe o nome e uma unidade válida.'},400)
                try:
                    cur = con.execute('INSERT INTO personnel(name,unit,active) VALUES(?,?,1)',(name,unit)); con.commit()
                except sqlite3.IntegrityError:
                    return self.json({'error':'Já existe um policial com esse nome nessa unidade.'},409)
                self.json({'ok':True,'id':cur.lastrowid})
            elif path == '/api/units':
                name = str(data.get('name','')).strip()
                if not name: return self.json({'error':'Informe o nome da unidade.'},400)
                try:
                    cur = con.execute('INSERT INTO units(name,active) VALUES(?,1)',(name,)); con.commit()
                except sqlite3.IntegrityError:
                    return self.json({'error':'Essa unidade já está cadastrada.'},409)
                self.json({'ok':True,'id':cur.lastrowid})
            elif path == '/api/operations':
                name = str(data.get('name','')).strip()
                if not name: return self.json({'error':'Informe o nome da operação.'},400)
                try:
                    cur = con.execute('INSERT INTO operations(name,active) VALUES(?,1)',(name,)); con.commit()
                except sqlite3.IntegrityError:
                    return self.json({'error':'Essa operação já está cadastrada.'},409)
                self.json({'ok':True,'id':cur.lastrowid})
            elif path == '/api/quotas':
                op = int(data.get('operation_id',0)); month = str(data.get('month','')); total = int(data.get('total',-1))
                if not re_month(month) or total < 0: return self.json({'error':'Informe mês válido e quantidade de cotas igual ou maior que zero.'},400)
                used = con.execute("SELECT COUNT(*) FROM scales WHERE operation_id=? AND month=? AND status!='Cancelada'",(op,month)).fetchone()[0]
                if total < used: return self.json({'error':f'Não é possível definir {total} cotas: já existem {used} escalas ativas nessa operação neste mês.'},409)
                if not con.execute('SELECT id FROM operations WHERE id=? AND active=1',(op,)).fetchone(): return self.json({'error':'Operação inválida.'},404)
                con.execute('INSERT INTO quotas(operation_id,month,total) VALUES(?,?,?) ON CONFLICT(operation_id,month) DO UPDATE SET total=excluded.total',(op,month,total)); con.commit(); self.json({'ok':True})
            elif path == '/api/scales':
                person = int(data.get('personnel_id',0)); op = int(data.get('operation_id',0)); d = str(data.get('scale_date','')); notes = str(data.get('notes','')).strip()
                if not valid_date(d): return self.json({'error':'Informe uma data válida.'},400)
                month = month_of(d)
                con.execute('BEGIN IMMEDIATE')
                p = con.execute('SELECT * FROM personnel WHERE id=? AND active=1',(person,)).fetchone()
                o = con.execute('SELECT * FROM operations WHERE id=? AND active=1',(op,)).fetchone()
                if not p or not o: con.rollback(); return self.json({'error':'Policial ou operação inválidos/inativos.'},400)
                count = con.execute("SELECT COUNT(*) FROM scales WHERE personnel_id=? AND month=? AND status!='Cancelada'",(person,month)).fetchone()[0]
                if count >= 12: con.rollback(); return self.json({'error':f"ESCALA BLOQUEADA: {p['name']} já possui {count} extras em {month}. O limite é 12 por mês."},409)
                q = con.execute('SELECT total FROM quotas WHERE operation_id=? AND month=?',(op,month)).fetchone()
                if not q: con.rollback(); return self.json({'error':f"Não há cotas cadastradas para {o['name']} em {month}. Cadastre o total autorizado antes de escalar."},409)
                used = con.execute("SELECT COUNT(*) FROM scales WHERE operation_id=? AND month=? AND status!='Cancelada'",(op,month)).fetchone()[0]
                if used >= q['total']: con.rollback(); return self.json({'error':f"COTAS ESGOTADAS: {o['name']} tem {q['total']} cotas autorizadas e todas já foram utilizadas."},409)
                cur = con.execute("INSERT INTO scales(personnel_id,operation_id,scale_date,month,notes,status) VALUES(?,?,?,?,?,'Ativa')",(person,op,d,month,notes))
                con.commit(); self.json({'ok':True,'id':cur.lastrowid,'message':'Escala registrada com sucesso.'})
            else: self.json({'error':'Endpoint não encontrado.'},404)
        except Exception as e:
            try: con.rollback()
            except: pass
            self.json({'error':'Erro ao processar solicitação: '+str(e)},500)
        finally: con.close()

    def do_PATCH(self):
        path = urlparse(self.path).path
        try:
            data = self.body()
            self._audit_data = data
        except Exception as e:
            return self.json({'error':str(e)},400)

        user = self.get_current_user()
        if not user:
            return self.json({'error': 'Não autenticado. Faça login no sistema.', 'auth_required': True}, 401)
        self._current_user = user

        if path.startswith('/api/auth/users/'):
            if user['role'] != 'admin':
                return self.json({'error': 'Acesso negado. Apenas o Administrador Geral pode gerenciar usuários.'}, 403)
            target_id = int(path.rsplit('/', 1)[1])
            con = connect()
            try:
                target = con.execute('SELECT * FROM users WHERE id=?', (target_id,)).fetchone()
                if not target:
                    return self.json({'error': 'Usuário não encontrado.'}, 404)
                if 'display_name' in data:
                    dname = str(data['display_name']).strip()
                    if dname:
                        con.execute('UPDATE users SET display_name=? WHERE id=?', (dname, target_id))
                if 'role' in data:
                    r = 'admin' if data['role'] == 'admin' else 'user'
                    if target_id == user['id'] and r != 'admin':
                        return self.json({'error': 'Você não pode remover seu próprio perfil de administrador.'}, 400)
                    con.execute('UPDATE users SET role=? WHERE id=?', (r, target_id))
                if 'active' in data:
                    act = 1 if data['active'] else 0
                    if target_id == user['id'] and act == 0:
                        return self.json({'error': 'Você não pode inativar seu próprio usuário.'}, 400)
                    con.execute('UPDATE users SET active=? WHERE id=?', (act, target_id))
                    if act == 0:
                        con.execute('DELETE FROM sessions WHERE user_id=?', (target_id,))
                if 'new_password' in data and str(data['new_password']).strip():
                    new_p = str(data['new_password']).strip()
                    if len(new_p) < 4:
                        return self.json({'error': 'A nova senha deve ter no mínimo 4 caracteres.'}, 400)
                    h, s = hash_password(new_p)
                    con.execute('UPDATE users SET password_hash=?, salt=? WHERE id=?', (h, s, target_id))
                    con.execute('DELETE FROM sessions WHERE user_id=?', (target_id,))
                con.commit()
                return self.json({'ok': True, 'message': 'Usuário atualizado com sucesso.'})
            finally:
                con.close()

        con = connect()
        try:
            if path.startswith('/api/personnel/'):
                pid = int(path.rsplit('/',1)[1]); name = str(data.get('name','')).strip(); unit = str(data.get('unit','')).strip(); active = int(bool(data.get('active',True)))
                if not name or not con.execute('SELECT id FROM units WHERE name=? AND active=1',(unit,)).fetchone(): return self.json({'error':'Nome e unidade válida são obrigatórios.'},400)
                con.execute('UPDATE personnel SET name=?,unit=?,active=? WHERE id=?',(name,unit,active,pid)); con.commit(); self.json({'ok':True})
            elif path.startswith('/api/operations/'):
                oid = int(path.rsplit('/',1)[1]); name = str(data.get('name','')).strip(); active = int(bool(data.get('active',True)))
                if not name: return self.json({'error':'Nome da operação é obrigatório.'},400)
                try: con.execute('UPDATE operations SET name=?,active=? WHERE id=?',(name,active,oid)); con.commit(); self.json({'ok':True})
                except sqlite3.IntegrityError: return self.json({'error':'Já existe outra operação com esse nome.'},409)
            elif path.startswith('/api/units/'):
                uid = int(path.rsplit('/',1)[1]); name = str(data.get('name','')).strip(); active = int(bool(data.get('active',True)))
                if not name: return self.json({'error':'Nome da unidade é obrigatório.'},400)
                old = con.execute('SELECT name FROM units WHERE id=?',(uid,)).fetchone()
                if not old: return self.json({'error':'Unidade não encontrada.'},404)
                try:
                    con.execute('UPDATE units SET name=?,active=? WHERE id=?',(name,active,uid))
                    if old['name'] != name: con.execute('UPDATE personnel SET unit=? WHERE unit=?',(name,old['name']))
                    con.commit(); self.json({'ok':True})
                except sqlite3.IntegrityError: return self.json({'error':'Já existe uma unidade com esse nome.'},409)
            elif path.startswith('/api/scales/'):
                sid = int(path.rsplit('/',1)[1]); status = str(data.get('status',''))
                if status not in ('Ativa','Concluída','Cancelada'): return self.json({'error':'Situação inválida.'},400)
                row = con.execute('SELECT * FROM scales WHERE id=?',(sid,)).fetchone()
                if not row: return self.json({'error':'Escala não encontrada.'},404)
                if row['status'] == 'Cancelada' and status != 'Cancelada':
                    c = con.execute("SELECT COUNT(*) FROM scales WHERE personnel_id=? AND month=? AND status!='Cancelada'",(row['personnel_id'],row['month'])).fetchone()[0]
                    q = con.execute('SELECT total FROM quotas WHERE operation_id=? AND month=?',(row['operation_id'],row['month'])).fetchone()
                    used = con.execute("SELECT COUNT(*) FROM scales WHERE operation_id=? AND month=? AND status!='Cancelada'",(row['operation_id'],row['month'])).fetchone()[0]
                    if c >= 12: return self.json({'error':'Não é possível reativar: o policial já atingiu 12 extras no mês.'},409)
                    if not q or used >= q['total']: return self.json({'error':'Não é possível reativar: não há cota disponível para essa operação.'},409)
                con.execute('UPDATE scales SET status=? WHERE id=?',(status,sid)); con.commit(); self.json({'ok':True})
            else: self.json({'error':'Endpoint não encontrado.'},404)
        except Exception as e: con.rollback(); self.json({'error':str(e)},500)
        finally: con.close()

    def do_DELETE(self):
        path = urlparse(self.path).path
        user = self.get_current_user()
        if not user:
            return self.json({'error': 'Não autenticado. Faça login no sistema.', 'auth_required': True}, 401)
        self._current_user = user

        if path.startswith('/api/auth/users/'):
            if user['role'] != 'admin':
                return self.json({'error': 'Acesso negado. Apenas o Administrador Geral pode inativar usuários.'}, 403)
            target_id = int(path.rsplit('/', 1)[1])
            if target_id == user['id']:
                return self.json({'error': 'Você não pode inativar seu próprio usuário.'}, 400)
            con = connect()
            try:
                con.execute('UPDATE users SET active=0 WHERE id=?', (target_id,))
                con.execute('DELETE FROM sessions WHERE user_id=?', (target_id,))
                con.commit()
                return self.json({'ok': True, 'message': 'Usuário inativado.'})
            finally:
                con.close()

        con = connect()
        try:
            if path.startswith('/api/scales/'):
                sid = int(path.rsplit('/',1)[1])
                old = con.execute('SELECT s.id,s.scale_date,p.name person_name,o.name operation_name FROM scales s JOIN personnel p ON p.id=s.personnel_id JOIN operations o ON o.id=s.operation_id WHERE s.id=?',(sid,)).fetchone()
                self._audit_data = dict(old) if old else {}
                cur = con.execute("DELETE FROM scales WHERE id=?",(sid,)); con.commit()
                if cur.rowcount == 0: return self.json({'error':'Escala não encontrada.'},404)
                self.json({'ok':True})
            elif path.startswith('/api/personnel/'):
                pid = int(path.rsplit('/',1)[1]); con.execute('UPDATE personnel SET active=0 WHERE id=?',(pid,)); con.commit(); self.json({'ok':True})
            elif path.startswith('/api/operations/'):
                oid = int(path.rsplit('/',1)[1]); con.execute('UPDATE operations SET active=0 WHERE id=?',(oid,)); con.commit(); self.json({'ok':True})
            elif path.startswith('/api/units/'):
                uid = int(path.rsplit('/',1)[1]); row = con.execute('SELECT name FROM units WHERE id=?',(uid,)).fetchone()
                if not row: return self.json({'error':'Unidade não encontrada.'},404)
                if con.execute('SELECT COUNT(*) FROM personnel WHERE unit=? AND active=1',(row['name'],)).fetchone()[0]:
                    return self.json({'error':'Transfira ou inative os policiais desta unidade antes de removê-la.'},409)
                con.execute('UPDATE units SET active=0 WHERE id=?',(uid,)); con.commit(); self.json({'ok':True})
            else: self.json({'error':'Endpoint não encontrado.'},404)
        except Exception as e: con.rollback(); self.json({'error':str(e)},500)
        finally: con.close()


def re_month(m):
    try: return len(m) == 7 and m[4] == '-' and 1 <= int(m[5:7]) <= 12 and int(m[:4]) >= 2000
    except: return False


def valid_date(d):
    try: return len(d) == 10 and date.fromisoformat(d).isoformat() == d
    except: return False


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    backup_database()
    init_db()
    print('\n' + '=' * 62)
    print(' CONTROLE DE EXTRAS | CPR XIII')
    print('=' * 62)
    print(f' Acesso neste computador: http://localhost:{PORT}')
    try:
        hostname = socket.gethostname(); ip = socket.gethostbyname(hostname)
        print(f' Acesso pela rede (pode variar): http://{ip}:{PORT}')
    except: pass
    print(' Banco de dados: controle_extras.db (nesta pasta)')
    print(' Sistema protegido por autenticação (Usuário e Senha).')
    print(' Mantenha esta janela aberta enquanto o sistema estiver em uso.')
    print(' Para encerrar, pressione CTRL+C.\n')
    try:
        with ThreadingServer((HOST, PORT), Handler) as httpd:
            try: webbrowser.open(f'http://localhost:{PORT}')
            except Exception: pass
            httpd.serve_forever()
    except KeyboardInterrupt: print('\nSistema encerrado.')
