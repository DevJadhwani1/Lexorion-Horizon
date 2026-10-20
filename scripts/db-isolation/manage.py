#!/usr/bin/env python3
"""Reviewable ownership migration for the inspected Horizon PostgreSQL topology.
No mutation without apply/rollback AND --execute-reviewed-plan. Secrets stay in
private plan files / stdin; psql output is never echoed on credential operations.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shlex
import subprocess

SERVICES = {'platform': 'platform_db', 'workforce': 'lexorion_workforce',
            'payroll': 'lexorion_payroll', 'finance': 'lexorion_finance'}
ROOT = Path(__file__).resolve().parents[2]
MARKER = 'horizon-db-isolation-v1'

def ident(s):
    return '"' + s.replace('"', '""') + '"'

def literal(s):
    return "'" + s.replace("'", "''") + "'"

def run(args, data=None):
    r = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args[:3]) + ' (output withheld; may contain private data)')
    return r.stdout

class Cluster:
    def __init__(self, container, admin):
        self.container, self.admin = container, admin
    def sql(self, db, sql):
        return run(['docker', 'exec', '-i', self.container, 'psql', '-X', '-qAt',
                    '-v', 'ON_ERROR_STOP=1', '-U', self.admin, '-d', db], sql.encode()).decode().strip()
    def rows(self, db, sql):
        return json.loads(self.sql(db, 'SELECT COALESCE(json_agg(x),\'[]\'::json) FROM (' + sql + ') x;'))
    def inventory(self):
        result = {'databases': self.rows('postgres', "SELECT datname,pg_get_userbyid(datdba) owner,datacl FROM pg_database ORDER BY datname"),
                  'roles': self.rows('postgres', "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolcanlogin,rolreplication,rolbypassrls,shobj_description(oid,'pg_authid') comment FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname"),
                  'memberships': self.rows('postgres', "SELECT roleid::regrole::text role,member::regrole::text member FROM pg_auth_members WHERE member::regrole::text !~ '^pg_'"), 'schemas': {}}
        for db in SERVICES.values():
            result['schemas'][db] = {
                'namespaces': self.rows(db, "SELECT nspname,pg_get_userbyid(nspowner) owner,nspacl FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'"),
                'relations': self.rows(db, "SELECT relname,relkind,pg_get_userbyid(relowner) owner,relacl FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname"),
                'extensions': self.rows(db, "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'"),
                'functions': self.rows(db, "SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace"),
                'types': self.rows(db, "SELECT typname FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype IN ('e','d','r','m')"),
                'defaults': self.rows(db, "SELECT defaclrole::regrole::text role,defaclobjtype,defaclacl FROM pg_default_acl"),
                'foreign': self.rows(db, "SELECT srvname FROM pg_foreign_server"),
                'large_objects': self.rows(db, "SELECT count(*) count FROM pg_largeobject_metadata"),
                'migrations': self.rows(db, "SELECT version,checksum,success FROM public.flyway_schema_history ORDER BY installed_rank")}
        return result
    def snapshot(self):
        result = {}
        for db in SERVICES.values():
            tables = self.rows(db, "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
            digest = {}
            for table in tables:
                name = table['tablename']
                # COPY stable row JSON, sorted independent of physical order; no rows printed.
                raw = self.sql(db, 'COPY (SELECT row_to_json(t)::text FROM public.' + ident(name) + ' t ORDER BY 1) TO STDOUT;')
                digest[name] = hashlib.sha256(raw.encode()).hexdigest()
            sequences = self.rows(db, "SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")
            indexes = self.rows(db, "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
            result[db] = {'table_hashes': digest, 'sequences': sequences, 'indexes': indexes}
        return result
    def idle(self):
        active = self.rows('postgres', "SELECT datname,usename FROM pg_stat_activity WHERE datname IN (" + ','.join(literal(v) for v in SERVICES.values()) + ") AND pid <> pg_backend_pid()")
        if active:
            raise RuntimeError('Stop all four application services and other database clients first; sessions remain.')

def check_original(inv, admin):
    expected = set(SERVICES.values()) | {'postgres', 'template0', 'template1'}
    if {d['datname'] for d in inv['databases']} != expected:
        raise RuntimeError('Unexpected database topology; DBA review required.')
    if len(inv['roles']) != 1 or inv['roles'][0]['rolname'] != admin or not inv['roles'][0]['rolsuper'] or inv['memberships']:
        raise RuntimeError('Unexpected roles/memberships; DBA review required.')
    for d in inv['databases']:
        if d['datname'] == 'postgres' and d['datacl'] is not None: raise RuntimeError('Unexpected maintenance database ACL.')
        if d['datname'] in ('template0','template1') and d['datacl'] != ['=c/'+admin, admin+'=CTc/'+admin]: raise RuntimeError('Unexpected template ACL.')
        if d['owner'] != admin or (d['datname'] in SERVICES.values() and d['datacl'] is not None):
            raise RuntimeError('Unexpected database owner/ACL; DBA review required.')
    for db, s in inv['schemas'].items():
        if len(s['namespaces']) != 1 or s['namespaces'][0]['nspname'] != 'public' or s['namespaces'][0]['owner'] != 'pg_database_owner' or s['namespaces'][0]['nspacl'] != ['pg_database_owner=UC/pg_database_owner','=U/pg_database_owner']:
            raise RuntimeError('Unexpected schema ownership/ACL in ' + db)
        if s['extensions'] or s['functions'] or s['types'] or s['defaults'] or s['foreign'] or s['large_objects'][0]['count']:
            raise RuntimeError('Unsupported database objects in ' + db + '; explicit DBA review required.')
        if any(r['owner'] != admin or r['relacl'] is not None or r['relkind'] not in ('r','i','S') for r in s['relations']):
            raise RuntimeError('Unexpected relation owner/ACL/kind in ' + db)
        if any(not m['success'] for m in s['migrations']):
            raise RuntimeError('Failed Flyway history in ' + db)


def write(path, content):
    with open(path, 'x', encoding='utf8') as f:
        os.chmod(path, 0o600)
        f.write(content)

def prepare(c, directory):
    inv = c.inventory(); check_original(inv, c.admin)
    directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    write(directory/'inventory.json', json.dumps(inv, indent=2))
    env = {}; roles = []; role_sql = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL log_statement = none;', 'SET LOCAL log_min_error_statement = panic;']
    for service in SERVICES:
        for suffix, key in [('', 'DB'), ('_migrator', 'MIGRATION')]:
            role = 'horizon_' + service + suffix; roles.append(role)
            env[service.upper()+'_'+key+'_USERNAME'] = role
            env[service.upper()+'_'+key+'_PASSWORD'] = secrets.token_urlsafe(48)
            role_sql += [f"SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT', {literal(role)}) WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname={literal(role)}) \\gexec",
                         f'COMMENT ON ROLE {ident(role)} IS {literal(MARKER)};',
                         f'\\getenv secret {service.upper()}_{key}_PASSWORD',
                         f"SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', {literal(role)}, :'secret') \\gexec"]
    role_sql += ['COMMIT;']
    write(directory/'roles.sql', '\n'.join(role_sql)+'\n')
    write(directory/'roles.env', ''.join(k+'='+v+'\n' for k,v in env.items()))
    for service, db in SERVICES.items():
        runtime='horizon_'+service; owner=runtime+'_migrator'; schema=inv['schemas'][db]
        sql=['\\set ON_ERROR_STOP on','BEGIN;',"SET LOCAL lock_timeout = '10s';", f'ALTER DATABASE {ident(db)} OWNER TO {ident(owner)};', f'REVOKE ALL ON DATABASE {ident(db)} FROM PUBLIC;']
        sql += [f'REVOKE ALL ON DATABASE {ident(db)} FROM {ident(role)};' for role in roles if role != owner]
        sql += [f'GRANT CONNECT ON DATABASE {ident(db)} TO {ident(runtime)};', f'ALTER SCHEMA public OWNER TO {ident(owner)};', 'REVOKE ALL ON SCHEMA public FROM PUBLIC;', f'GRANT USAGE ON SCHEMA public TO {ident(runtime)};']
        rollback=['\\set ON_ERROR_STOP on','BEGIN;',"SET LOCAL lock_timeout = '10s';"]
        for r in schema['relations']:
            if r['relkind']=='i': continue # table ownership carries indexes/TOAST automatically
            kind='SEQUENCE' if r['relkind']=='S' else 'TABLE'
            sql += [f'ALTER {kind} public.{ident(r["relname"])} OWNER TO {ident(owner)};']
            rollback += [f'REVOKE ALL ON {kind} public.{ident(r["relname"])} FROM {ident(runtime)};', f'ALTER {kind} public.{ident(r["relname"])} OWNER TO {ident(c.admin)};']
        sql += [f'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO {ident(runtime)};', f'REVOKE ALL ON TABLE public.flyway_schema_history FROM {ident(runtime)};', f'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO {ident(runtime)};', f'ALTER DEFAULT PRIVILEGES FOR ROLE {ident(owner)} IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO {ident(runtime)};', f'ALTER DEFAULT PRIVILEGES FOR ROLE {ident(owner)} IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO {ident(runtime)};', 'COMMIT;']
        rollback += [f'ALTER DEFAULT PRIVILEGES FOR ROLE {ident(owner)} IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM {ident(runtime)};',f'ALTER DEFAULT PRIVILEGES FOR ROLE {ident(owner)} IN SCHEMA public REVOKE USAGE,SELECT ON SEQUENCES FROM {ident(runtime)};',f'REVOKE ALL ON SCHEMA public FROM {ident(runtime)};', 'ALTER SCHEMA public OWNER TO pg_database_owner;', 'GRANT USAGE ON SCHEMA public TO PUBLIC;',f'ALTER DATABASE {ident(db)} OWNER TO {ident(c.admin)};']
        rollback += [f'REVOKE ALL ON DATABASE {ident(db)} FROM {ident(role)};' for role in roles]
        rollback += [f'GRANT CONNECT,TEMPORARY ON DATABASE {ident(db)} TO PUBLIC;', 'COMMIT;']
        write(directory/(service+'.sql'),'\n'.join(sql)+'\n');write(directory/(service+'.rollback.sql'),'\n'.join(rollback)+'\n')
    # Maintenance databases cannot be used as a side door by application logins.
    write(directory/'maintenance.sql','BEGIN;\nREVOKE CONNECT,TEMPORARY ON DATABASE postgres FROM PUBLIC;\nREVOKE CONNECT,TEMPORARY ON DATABASE template1 FROM PUBLIC;\nCOMMIT;\n')
    write(directory/'maintenance.rollback.sql','BEGIN;\nGRANT CONNECT,TEMPORARY ON DATABASE postgres TO PUBLIC;\nGRANT CONNECT ON DATABASE template1 TO PUBLIC;\nCOMMIT;\n')
    manifest={'container':c.container,'admin':c.admin,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir()}}
    write(directory/'manifest.json',json.dumps(manifest,indent=2))
    print('Private plan prepared. Review SQL and inventory; no database mutations performed.')

def checked_plan(c, directory):
    m=json.loads((directory/'manifest.json').read_text())
    if m['container'] != c.container or m['admin'] != c.admin: raise RuntimeError('Plan targets a different cluster/container.')
    for name,digest in m['files'].items():
        if hashlib.sha256((directory/name).read_bytes()).hexdigest()!=digest: raise RuntimeError('Reviewed plan modified: '+name)
    return dict(line.split('=',1) for line in (directory/'roles.env').read_text().splitlines())

def apply(c, directory):
    env=checked_plan(c,directory);c.idle()
    original=json.loads((directory/'inventory.json').read_text()); current=c.inventory()
    # Allow a partial/repeated application only for this marker and exact known objects.
    expected={'horizon_'+s+suffix for s in SERVICES for suffix in ('','_migrator')}
    for r in current['roles']:
        if r['rolname']==c.admin: continue
        if r['rolname'] not in expected or r['comment']!=MARKER or any(r[k] for k in ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']): raise RuntimeError('Unexpected or privileged target role.')
    if current['memberships']: raise RuntimeError('Unexpected role memberships.')
    if {d['datname'] for d in current['databases']} != {d['datname'] for d in original['databases']}: raise RuntimeError('Database topology changed.')
    for db,s in current['schemas'].items():
        if [(r['relname'],r['relkind']) for r in s['relations']] != [(r['relname'],r['relkind']) for r in original['schemas'][db]['relations']]: raise RuntimeError('Relations changed; re-review required.')
        if s['extensions'] or s['functions'] or s['types'] or s['foreign'] or s['large_objects'][0]['count']: raise RuntimeError('Unsupported objects; re-review required.')
        if s['migrations'] != original['schemas'][db]['migrations']: raise RuntimeError('Migrations changed; re-review required.')
    for service, db in SERVICES.items():
        s=current['schemas'][db]; owner='horizon_'+service+'_migrator'; runtime='horizon_'+service
        if len(s['namespaces']) != 1 or s['namespaces'][0]['nspname'] != 'public' or s['namespaces'][0]['owner'] not in ('pg_database_owner',owner):
            raise RuntimeError('Schema ownership changed; re-review required.')
        if any(r['owner'] not in (c.admin,owner) for r in s['relations']):
            raise RuntimeError('Unexpected relation ownership; re-review required.')
        if any(d['owner'] not in (c.admin,owner) for d in current['databases'] if d['datname']==db):
            raise RuntimeError('Unexpected database ownership; re-review required.')
        for r in s['relations']:
            if r['relacl'] and any(not v.startswith((c.admin+'=',owner+'=',runtime+'=')) for v in r['relacl']):
                raise RuntimeError('Unexpected relation grants; re-review required.')
    before=c.snapshot();write(directory/'before-apply.json',json.dumps(before,indent=2)) if not (directory/'before-apply.json').exists() else None
    # Environment assignments go through stdin to the container shell, not argv/logs.
    shell='set -eu\n'+''.join('export '+k+'='+shlex.quote(v)+'\n' for k,v in env.items())
    shell+='exec psql -X -q -v ON_ERROR_STOP=1 -U '+shlex.quote(c.admin)+' -d postgres <<\'HORIZON_SQL\'\n'+(directory/'roles.sql').read_text()+'HORIZON_SQL\n'
    run(['docker','exec','-i',c.container,'sh'],shell.encode())
    for service,db in SERVICES.items():c.sql(db,(directory/(service+'.sql')).read_text())
    c.sql('postgres',(directory/'maintenance.sql').read_text())
    if c.snapshot()!=before: raise RuntimeError('Preservation verification failed. Keep maintenance window; investigate/rollback.')
    print('Ownership/grants applied. All table hashes, sequence positions and index definitions unchanged.')

def rollback(c,directory):
    checked_plan(c,directory);c.idle()
    original=json.loads((directory/'inventory.json').read_text());current=c.inventory()
    for db,s in current['schemas'].items():
        if [(r['relname'],r['relkind']) for r in s['relations']] != [(r['relname'],r['relkind']) for r in original['schemas'][db]['relations']] or s['migrations']!=original['schemas'][db]['migrations']:
            raise RuntimeError('Schema/migrations changed after plan; reviewed DBA rollback required.')
    before=c.snapshot()
    for service,db in SERVICES.items():c.sql(db,(directory/(service+'.rollback.sql')).read_text())
    c.sql('postgres',(directory/'maintenance.rollback.sql').read_text())
    for service in SERVICES:
        for suffix in ('','_migrator'):
            role='horizon_'+service+suffix
            if c.rows('postgres','SELECT rolname FROM pg_roles WHERE rolname='+literal(role)):
                c.sql('postgres',f'ALTER ROLE {ident(role)} NOLOGIN;')
    if c.snapshot()!=before: raise RuntimeError('Rollback preservation check failed.')
    print('Original effective ownership/grants restored; new roles retained NOLOGIN. Restore the protected prior application configuration explicitly.')

def verify(c,directory,require_runtime_pools=False):
    env=checked_plan(c,directory); passed=0
    for service,db in SERVICES.items():
        for key in ('DB','MIGRATION'):
            user=env[service.upper()+'_'+key+'_USERNAME'];password=env[service.upper()+'_'+key+'_PASSWORD']
            for target in [*SERVICES.values(),'postgres','template1']:
                sql='SELECT current_user;'
                shell='export PGPASSWORD='+shlex.quote(password)+'\nexec psql -X -w -h 127.0.0.1 -U '+shlex.quote(user)+' -d '+shlex.quote(target)+' -At -c '+shlex.quote(sql)+'\n'
                r=subprocess.run(['docker','exec','-i',c.container,'sh'],input=shell.encode(),capture_output=True)
                if target==db:
                    if r.returncode or r.stdout.decode().strip()!=user:raise RuntimeError('Own-database login failed: '+user)
                elif not r.returncode or b'permission denied for database' not in r.stderr:raise RuntimeError('Expected CONNECT denial: '+user+' -> '+target)
                passed+=1
    for service,db in SERVICES.items():
        user=env[service.upper()+'_DB_USERNAME']; password=env[service.upper()+'_DB_PASSWORD']; owner='horizon_'+service+'_migrator'
        sql="SELECT NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR pg_has_role(current_user,"+literal(owner)+",'MEMBER') OR has_schema_privilege('public','CREATE') OR has_database_privilege(current_database(),'CREATE') OR has_table_privilege('public.flyway_schema_history','SELECT,INSERT,UPDATE,DELETE')) FROM pg_roles WHERE rolname=current_user;"
        shell='export PGPASSWORD='+shlex.quote(password)+'\nexec psql -X -w -h 127.0.0.1 -U '+shlex.quote(user)+' -d '+shlex.quote(db)+' -At -c '+shlex.quote(sql)+'\n'
        if run(['docker','exec','-i',c.container,'sh'],shell.encode()).decode().strip()!='t': raise RuntimeError('Unexpected runtime authority: '+user)
    print('PASS runtime role attributes, no migration-role membership, no schema/database CREATE or Flyway-history DML.')
    print(f'PASS {passed} real TCP/password connection checks: 8 own-database successes, 40 foreign/maintenance denials.')
    if require_runtime_pools:
        sessions=c.rows('postgres',"SELECT datname,usename,count(*) connections FROM pg_stat_activity WHERE backend_type='client backend' AND datname IN ("+','.join(literal(db) for db in SERVICES.values())+") GROUP BY datname,usename")
        for service,db in SERVICES.items():
            users={row['usename'] for row in sessions if row['datname']==db}
            runtime='horizon_'+service
            if runtime not in users or not users.issubset({runtime,runtime+'_migrator'}):
                raise RuntimeError('Missing runtime pool or unexpected live database identity: '+db)
        print('PASS live PostgreSQL pools use all four restricted runtime identities; no shared/foreign application identity.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['inspect','prepare','apply','rollback','verify','snapshot']);p.add_argument('--container',required=True);p.add_argument('--admin',default='postgres');p.add_argument('--directory',type=Path);p.add_argument('--execute-reviewed-plan',action='store_true');p.add_argument('--require-runtime-pools',action='store_true');a=p.parse_args();c=Cluster(a.container,a.admin)
    if a.command in ('apply','rollback') and not a.execute_reviewed_plan:p.error('Mutation requires explicit --execute-reviewed-plan after operator approval.')
    if a.command in ('inspect','snapshot'):print(json.dumps(c.inventory() if a.command=='inspect' else c.snapshot(),indent=2))
    else:
        if not a.directory:p.error('--directory required')
        if a.command=='verify':verify(c,a.directory,a.require_runtime_pools)
        else:globals()[a.command](c,a.directory)
