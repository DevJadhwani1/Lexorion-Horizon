#!/usr/bin/env python3
"""Write a NEW private Compose env file; never overwrite current configuration.
Review the output privately, validate with compose.db-isolation.yml, then install
it only after approved ownership migration. Does not restart any service.
"""
import argparse
import os
from pathlib import Path
import re

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--current',type=Path,required=True);p.add_argument('--roles',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
roles=dict(line.split('=',1) for line in a.roles.read_text().splitlines())
expected={service+'_'+kind+'_'+field for service in ['PLATFORM','WORKFORCE','PAYROLL','FINANCE'] for kind in ['DB','MIGRATION'] for field in ['USERNAME','PASSWORD']}
if set(roles)!=expected or any(not v for v in roles.values()):raise SystemExit('Unexpected/incomplete role configuration.')
lines=[]
for line in a.current.read_text().splitlines():
    match=re.match(r'\s*(?:export\s+)?([A-Z_]+)\s*=',line)
    if not match or match.group(1) not in expected:lines.append(line)
fd=os.open(a.output,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as stream:stream.write('\n'.join(lines)+'\n'+''.join(k+'='+v+'\n' for k,v in roles.items()))
print('Wrote new private configuration; current configuration and services unchanged.')
