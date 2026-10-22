#!/usr/bin/env python3
"""Generate fresh local credentials or validate effective Compose without printing secrets."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('command', choices=['init', 'check'])
parser.add_argument('--env-file', type=Path, help='Explicit configuration to validate without installing it')
parser.add_argument('--isolated', action='store_true', help='Require separate Flyway credentials using compose.db-isolation.yml')
args = parser.parse_args()
if args.command == 'init':
    # Never overwrite a deployment: PostgreSQL passwords do not change with .env.
    fd = os.open(ROOT / '.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    volume_name = 'horizon-postgres-' + secrets.token_hex(6)
    with os.fdopen(fd, 'w') as stream:
        stream.write(f'POSTGRES_DATA_VOLUME={volume_name}\n')
        stream.write('POSTGRES_USER=horizon_provisioner\nLEXORION_BOOTSTRAP_ENABLED=false\n')
        for name in ['PLATFORM', 'WORKFORCE', 'PAYROLL', 'FINANCE']:
            stream.write(f'{name}_DB_USERNAME=horizon_{name.lower()}\n{name}_DB_PASSWORD={secrets.token_urlsafe(48)}\n')
        for key in ['POSTGRES_PASSWORD', 'JWT_SECRET', 'WORKFORCE_SERVICE_TOKEN', 'PAYROLL_SERVICE_TOKEN', 'FINANCE_SERVICE_TOKEN']:
            stream.write(f'{key}={secrets.token_urlsafe(48)}\n')
    print(f'Create the new persistent volume with: docker volume create {volume_name}')
    print('Created private .env for a NEW database. Configure bootstrap explicitly if needed.')
else:
    command = ['docker', 'compose']
    if args.env_file:
        command += ['--env-file', str(args.env_file)]
    command += ['-f', 'docker-compose.yml']
    if args.isolated:
        command += ['-f', 'compose.db-isolation.yml']
    result = subprocess.run(command + ['config', '--format', 'json'], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('Compose configuration rejected. Supply all required variables; run docker compose config -q for variable names.')
    services = json.loads(result.stdout)['services']
    platform = services['platform']['environment']
    values = [platform[key] for key in ['JWT_SECRET', 'WORKFORCE_SERVICE_TOKEN', 'PAYROLL_SERVICE_TOKEN', 'FINANCE_SERVICE_TOKEN']]
    if any(not isinstance(value, str) or len(value.encode()) < 32 for value in values) or len(set(values)) != len(values):
        raise SystemExit('JWT and service credentials must each be independent secrets of at least 32 bytes.')
    if any('local-development-only' in value or 'change-me' in value.lower() for value in values):
        raise SystemExit('Placeholder credentials are not allowed.')
    db_users = []; db_passwords = []
    for name in ['platform', 'workforce', 'payroll', 'finance']:
        env = services[name]['environment']
        db_users.append(env.get('DB_USERNAME')); db_passwords.append(env.get('DB_PASSWORD'))
        if not env.get('DB_USERNAME') or len(env.get('DB_PASSWORD', '')) < 16:
            raise SystemExit(f'{name}: configure explicit database credentials (password at least 16 characters).')
    if args.isolated:
        for name in ['platform', 'workforce', 'payroll', 'finance']:
            env = services[name]['environment']
            if not env.get('SPRING_FLYWAY_USER') or len(env.get('SPRING_FLYWAY_PASSWORD', '')) < 32:
                raise SystemExit(f'{name}: separate explicit Flyway credentials are required.')
            db_users.append(env['SPRING_FLYWAY_USER']); db_passwords.append(env['SPRING_FLYWAY_PASSWORD'])
    postgres = services['postgres']['environment']
    if len(postgres['POSTGRES_PASSWORD']) < 16:
        raise SystemExit('Database provisioning password must be at least 16 characters.')
    if len(set(db_users + [postgres['POSTGRES_USER']])) != len(db_users) + 1 or len(set(db_passwords + [postgres['POSTGRES_PASSWORD']])) != len(db_passwords) + 1:
        raise SystemExit('Each service and the database provisioner need distinct roles and passwords.')
    for service, key in [('workforce', 'WORKFORCE_SERVICE_TOKEN'), ('workforce', 'PAYROLL_SERVICE_TOKEN'), ('payroll', 'PAYROLL_SERVICE_TOKEN'), ('finance', 'FINANCE_SERVICE_TOKEN')]:
        if services[service]['environment'][key] != platform[key]:
            raise SystemExit(f'{service}: inconsistent service credential.')
    if str(platform.get('LEXORION_BOOTSTRAP_ENABLED', '')).lower() == 'true':
        if not platform.get('LEXORION_BOOTSTRAP_EMAIL') or len(platform.get('LEXORION_BOOTSTRAP_PASSWORD', '')) < 12:
            raise SystemExit('Bootstrap requires an explicit email and password of at least 12 characters.')
        print('Bootstrap enabled: only one platform instance on an EMPTY identity store; disable immediately afterward.')
    print('Effective Compose configuration passed credential and service-consistency checks. No secret values printed.')
