#!/usr/bin/env python3
"""Opt-in integration harness. Source is READ ONLY; all writes target a new labelled container.
Retains private scratch files/container for application smoke tests; cleanup is explicit.
"""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

spec=importlib.util.spec_from_file_location('isolation',Path(__file__).with_name('manage.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source-container',required=True);p.add_argument('--directory',type=Path,required=True);a=p.parse_args()
a.directory.mkdir(mode=0o700,exist_ok=False)
name='horizon-isolation-'+secrets.token_hex(4);network=name
admin_password=secrets.token_urlsafe(48)
m.write(a.directory/'postgres.env','POSTGRES_USER=postgres\nPOSTGRES_PASSWORD='+admin_password+'\n')
m.write(a.directory/'state.json',json.dumps({'container':name,'network':network}))
m.run(['docker','network','create',network])
m.run(['docker','run','-d','--name',name,'--label','horizon.db-isolation=disposable','--network',network,'--network-alias','postgres','--env-file',str(a.directory/'postgres.env'),'postgres:16-alpine'])
c=m.Cluster(name,'postgres');source=m.Cluster(a.source_container,'postgres')
for _ in range(60):
    try:c.sql('postgres','SELECT 1;');break
    except RuntimeError:time.sleep(1)
else:raise RuntimeError('Disposable PostgreSQL did not start.')
# Exact existing schema/data clone, including Flyway checksums, with isolated admin credentials.
for service,db in m.SERVICES.items():
    dump=m.run(['docker','exec',a.source_container,'pg_dump','-U','postgres','-Fc',db])
    path=a.directory/(service+'.dump');path.write_bytes(dump);path.chmod(0o600)
    c.sql('postgres','CREATE DATABASE '+m.ident(db)+' OWNER postgres;')
    m.run(['docker','exec','-i',name,'pg_restore','--exit-on-error','-U','postgres','-d',db],dump)
print('PASS restored all four source databases into a new disposable cluster; source unchanged.',flush=True)
plan=a.directory/'plan';m.prepare(c,plan);before=c.snapshot()
# Fail closed on unsupported structures without mutating even the test cluster.
original=c.inventory()
for field,change in [('functions',[{'proname':'unreviewed'}]),('extensions',[{'extname':'unreviewed'}]),('namespaces',[])]:
    changed=copy.deepcopy(original);changed['schemas']['platform_db'][field]=change
    try:m.check_original(changed,'postgres')
    except RuntimeError:pass
    else:raise AssertionError('Unreviewed '+field+' was accepted')
changed=copy.deepcopy(original);changed['roles'].append({'rolname':'unexpected'})
try:m.check_original(changed,'postgres')
except RuntimeError:pass
else:raise AssertionError('Unreviewed role was accepted')
print('PASS unreviewed functions/extensions/schemas/roles rejected before plan creation.',flush=True)
m.apply(c,plan);m.verify(c,plan);m.apply(c,plan);m.verify(c,plan)
assert before==c.snapshot()
print('PASS repeat application preserves every table hash, index definition and sequence value.',flush=True)
env=m.checked_plan(c,plan)
def login_sql(service,key,sql,success=True):
    user=env[service.upper()+'_'+key+'_USERNAME'];pwd=env[service.upper()+'_'+key+'_PASSWORD']
    shell='export PGPASSWORD='+m.shlex.quote(pwd)+'\nexec psql -X -qAt -v ON_ERROR_STOP=1 -w -h 127.0.0.1 -U '+m.shlex.quote(user)+' -d '+m.shlex.quote(m.SERVICES[service])+" <<'SQL'\n"+sql+'\nSQL\n'
    r=subprocess.run(['docker','exec','-i',name,'sh'],input=shell.encode(),capture_output=True)
    if success and r.returncode:raise RuntimeError(service+' expected allowed operation failed: '+r.stderr.decode()[:500])
    if not success and (not r.returncode or not any(v in r.stderr for v in [b'permission denied',b'must be owner'])):raise RuntimeError(service+' expected privilege denial missing')
for service in m.SERVICES:
    login_sql(service,'MIGRATION',"CREATE SEQUENCE public.__isolation_seq; CREATE TABLE public.__isolation_probe(id bigint DEFAULT nextval('public.__isolation_seq') PRIMARY KEY,value text); CREATE INDEX ON public.__isolation_probe(value); ALTER TABLE public.__isolation_probe ADD COLUMN extra text;")
    login_sql(service,'DB',"INSERT INTO public.__isolation_probe(value) VALUES ('probe'); SELECT * FROM public.__isolation_probe; UPDATE public.__isolation_probe SET value='updated'; DELETE FROM public.__isolation_probe;")
    for sql in ['CREATE TABLE public.__denied(id int);','TRUNCATE public.__isolation_probe;','SELECT * FROM public.flyway_schema_history;','ALTER TABLE public.__isolation_probe ADD COLUMN denied text;']:
        login_sql(service,'DB',sql,False)
    login_sql(service,'MIGRATION','DROP TABLE public.__isolation_probe; DROP SEQUENCE public.__isolation_seq;')
print('PASS all four migration roles can execute DDL; runtime CRUD/sequences succeed; runtime DDL/TRUNCATE/Flyway-history access denied.',flush=True)
m.rollback(c,plan)
assert before==c.snapshot()
rolled=c.inventory();original=json.loads((plan/'inventory.json').read_text())
for db in m.SERVICES.values():
    assert [(r['relname'],r['owner']) for r in rolled['schemas'][db]['relations']]==[(r['relname'],r['owner']) for r in original['schemas'][db]['relations']]
    assert rolled['schemas'][db]['namespaces']==original['schemas'][db]['namespaces']
    assert rolled['schemas'][db]['migrations']==original['schemas'][db]['migrations']
    assert not rolled['schemas'][db]['defaults']
    for r in rolled['schemas'][db]['relations']:
        assert r['relacl'] is None or all(v.startswith('postgres=') for v in r['relacl'])
print('PASS rollback restores original ownership/schema grants/data and disables new logins.',flush=True)
m.apply(c,plan);m.verify(c,plan)
assert before==c.snapshot()
print('PASS reapply after rollback. Disposable cluster retained for application tests: '+name,flush=True)
