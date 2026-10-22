#!/usr/bin/env python3
"""Start existing application images against the labelled disposable cluster only.
Generated Compose contains credentials: private directory, no output of its contents.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess

p=argparse.ArgumentParser(description=__doc__);p.add_argument('--directory',type=Path,required=True);p.add_argument('--port',type=int,default=19000);a=p.parse_args()
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
state=json.loads((a.directory/'state.json').read_text());db=inspect(state['container'])
if db['Config']['Labels'].get('horizon.db-isolation')!='disposable':raise SystemExit('Refusing non-disposable database target.')
roles=dict(l.split('=',1) for l in (a.directory/'plan/roles.env').read_text().splitlines())
services={};tokens={k:secrets.token_urlsafe(48) for k in ['JWT_SECRET','WORKFORCE_SERVICE_TOKEN','PAYROLL_SERVICE_TOKEN','FINANCE_SERVICE_TOKEN']}
for service in ['eureka','platform','workforce','payroll','finance','gateway','frontend']:
    original=inspect('lexorion-horizon-'+service+'-1')
    env=dict(v.split('=',1) for v in original['Config']['Env'])
    # Explicit environment only, independent keys; bootstrap/email cannot send externally.
    for key in list(env):
        if key in tokens:env[key]=tokens[key]
        if key.startswith('LEXORION_BOOTSTRAP_') or key.startswith('SMTP_') or key.startswith('INVITATION_'):del env[key]
    if service=='platform':env['LEXORION_BOOTSTRAP_ENABLED']='false';env['SMTP_HOST']='';env['MANAGEMENT_HEALTH_MAIL_ENABLED']='false'
    if service in ['platform','workforce','payroll','finance']:
        env['DB_HOST']='postgres';env['DB_USERNAME']=roles[service.upper()+'_DB_USERNAME'];env['DB_PASSWORD']=roles[service.upper()+'_DB_PASSWORD']
        env['SPRING_FLYWAY_USER']=roles[service.upper()+'_MIGRATION_USERNAME'];env['SPRING_FLYWAY_PASSWORD']=roles[service.upper()+'_MIGRATION_PASSWORD']
    services[service]={'image':original['Image'],'environment':env,'networks':['isolated']}
    if original['Config'].get('Healthcheck'):
        h=original['Config']['Healthcheck'];services[service]['healthcheck']={'test':h['Test'],'interval':'5s','timeout':'5s','retries':36,'start_period':'30s'}
    dependencies={'platform':['eureka'],'finance':['platform'],'workforce':['platform'],'payroll':['workforce'],'gateway':['eureka'],'frontend':['gateway']}.get(service,[])
    if dependencies:services[service]['depends_on']={s:{'condition':'service_healthy'} for s in dependencies}
services['frontend']['ports']=[f'127.0.0.1:{a.port}:9000']
config={'name':state['container']+'-apps','services':services,'networks':{'isolated':{'external':True,'name':state['network']}}}
file=a.directory/'apps.json'
with open(file,'w') as f:os.chmod(file,0o600);json.dump(config,f)
subprocess.run(['docker','compose','-f',str(file),'up','-d','--wait','--wait-timeout','180'],check=True)
print('Disposable applications ready at http://localhost:'+str(a.port))
