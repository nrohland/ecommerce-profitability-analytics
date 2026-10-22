"""Audit locked npm packages; temporary exceptions apply to exact dev-only leaves."""
import argparse
from datetime import date
import json
from pathlib import Path
import subprocess

HIGH = {'high', 'critical'}

def evaluate(audit, lock, exceptions, today):
    if 'error' in audit or not isinstance(audit.get('vulnerabilities'), dict):
        raise ValueError('npm audit failed or returned no vulnerability inventory')
    failures, accepted = set(), set()
    packages = lock.get('packages', {})
    for package, minimum in [('next', (16, 4, 1)), ('sharp', (0, 35, 5))]:
        record = packages.get('node_modules/' + package)
        if record:
            version = record['version']
            try: parsed = tuple(int(x) for x in version.split('.'))
            except ValueError: raise ValueError('Unreviewed prerelease version: ' + package)
            if parsed < minimum: failures.add('Minimum reviewed version not met: ' + package)

    def inspect(name, trail=()):
        if name in trail: raise ValueError('Cyclic or unresolved npm advisory graph')
        item = audit['vulnerabilities'].get(name)
        if not item: raise ValueError('Unresolved inherited advisory: ' + name)
        if not item.get('via'): raise ValueError('Missing advisory detail: ' + name)
        for via in item['via']:
            if isinstance(via, str):
                inspect(via, (*trail, name)); continue
            if via.get('severity') not in {'info','low','moderate','high','critical'}:
                raise ValueError('Missing advisory severity')
            if via['severity'] not in HIGH: continue
            url = via.get('url', '')
            nodes = item.get('nodes', [])
            dev_only = bool(nodes) and all(packages.get(node, {}).get('dev') is True for node in nodes)
            allowed = any(e.get('package') == name and e.get('advisory') == url
                          and dev_only and today <= date.fromisoformat(e['expires'])
                          and bool(e.get('reason', '').strip()) for e in exceptions)
            message = name + ': ' + url
            (accepted if allowed else failures).add(message)

    for name, item in audit['vulnerabilities'].items():
        if item.get('severity') in HIGH: inspect(name)
    return {'status': 'fail' if failures else 'pass',
            'blocked': sorted(failures), 'temporary_dev_exceptions': sorted(accepted),
            'raw_counts': audit.get('metadata', {}).get('vulnerabilities', {})}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', default='.')
    parser.add_argument('--exceptions', default='security/audit-exceptions.json')
    args = parser.parse_args()
    directory = Path(args.directory).resolve()
    process = subprocess.run(['npm', 'audit', '--package-lock-only', '--json', '--audit-level=high'],
                             cwd=directory, capture_output=True, text=True)
    if process.returncode not in (0, 1): raise ValueError('npm audit command unavailable')
    inventory = json.loads(process.stdout)
    policy = json.loads(Path(args.exceptions).read_text())
    result = evaluate(inventory, json.loads((directory/'package-lock.json').read_text()),
                      policy['exceptions'], date.today())
    print(json.dumps(result, indent=2))
    return 1 if result['blocked'] else 0

if __name__ == '__main__':
    try: raise SystemExit(main())
    except (ValueError, KeyError, OSError, TypeError) as error:
        # Do not expose npm command output, credentials or full exception content.
        print(json.dumps({'status':'fail','reason':type(error).__name__}))
        raise SystemExit(2)
