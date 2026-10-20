#!/usr/bin/env python3
"""Disposable clean-schema Flyway/startup test using the reviewed split credentials.
Uses existing images; never connects to the existing installation's databases.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
spec=importlib.util.spec_from_file_location('isolation',Path(__file__).with_name('manage.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--directory',type=Path,required=True);a=p.parse_args()
config=json.loads((a.directory/'apps.json').read_text());roles=dict(l.split('=',1) for l in (a.directory/'plan/roles.env').read_text().splitlines())
name='horizon-isolation-fresh-'+secrets.token_hex(4);network=name;c=m.Cluster(name,'postgres')
secret=a.directory/'fresh-postgres.env';m.write(secret,'POSTGRES_USER=postgres\nPOSTGRES_PASSWORD='+secrets.token_urlsafe(48)+'\n')
started=[]
try:
    m.run(['docker','network','create',network]);m.run(['docker','run','-d','--name',name,'--label','horizon.db-isolation=disposable','--network',network,'--network-alias','postgres','--env-file',str(secret),'postgres:16-alpine'])
    for _ in range(60):
        try:c.sql('postgres','SELECT 1;');break
        except RuntimeError:time.sleep(1)
    else:raise RuntimeError('Fresh PostgreSQL not ready')
    shell='set -eu\n'+''.join('export '+k+'='+m.shlex.quote(v)+'\n' for k,v in roles.items())+"psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'\n"+(a.directory/'plan/roles.sql').read_text()+'SQL\n'
    m.run(['docker','exec','-i',name,'sh'],shell.encode())
    for service,db in m.SERVICES.items():
        runtime='horizon_'+service;owner=runtime+'_migrator'
        c.sql('postgres',f'CREATE DATABASE {m.ident(db)} OWNER {m.ident(owner)};')
        c.sql(db,f'REVOKE ALL ON DATABASE {m.ident(db)} FROM PUBLIC; GRANT CONNECT ON DATABASE {m.ident(db)} TO {m.ident(runtime)}; REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO {m.ident(runtime)}; ALTER DEFAULT PRIVILEGES FOR ROLE {m.ident(owner)} IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO {m.ident(runtime)}; ALTER DEFAULT PRIVILEGES FOR ROLE {m.ident(owner)} IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO {m.ident(runtime)};')
        app=name+'-'+service;started.append(app);env=dict(config['services'][service]['environment']);env['EUREKA_CLIENT_ENABLED']='false';env['SPRING_CLOUD_DISCOVERY_ENABLED']='false'
        path=a.directory/(service+'-fresh.env');m.write(path,''.join(k+'='+v+'\n' for k,v in env.items()))
        m.run(['docker','run','-d','--name',app,'--network',network,'--env-file',str(path),config['services'][service]['image']])
        port={'platform':9002,'workforce':9004,'payroll':9005,'finance':9006}[service]
        for _ in range(90):
            r=subprocess.run(['docker','exec',app,'wget','-q','--spider',f'http://localhost:{port}/actuator/health'],capture_output=True)
            if r.returncode==0:break
            time.sleep(1)
        else:raise RuntimeError(service+' fresh migration/startup failed (inspect private container logs)')
        history=c.rows(db,'SELECT version,installed_by,success FROM public.flyway_schema_history ORDER BY installed_rank')
        expected={'platform':9,'workforce':2,'payroll':7,'finance':1}[service]
        assert len(history)==expected and all(r['success'] and r['installed_by']==owner for r in history)
        c.sql(db,f'REVOKE ALL ON public.flyway_schema_history FROM {m.ident(runtime)};')
        print(f'PASS {service}: {expected} Flyway migrations executed as {owner}; runtime datasource healthy.',flush=True)
        m.run(['docker','rm','-f',app]);started.remove(app)
finally:
    for app in started:subprocess.run(['docker','rm','-f',app],capture_output=True)
    subprocess.run(['docker','rm','-fv',name],capture_output=True);subprocess.run(['docker','network','rm',network],capture_output=True)
