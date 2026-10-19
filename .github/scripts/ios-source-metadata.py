"""Read source metadata from the actual unsigned IPA; never invent plist values."""
import argparse
import json
import plistlib
import re
import zipfile
from pathlib import Path


def extract(ipa, tag, entitlement_files=()):
    with zipfile.ZipFile(ipa) as archive:
        infos = [name for name in archive.namelist() if re.fullmatch(r'Payload/[^/]+\.app/Info\.plist', name)]
        if len(infos) != 1:
            raise ValueError('Expected one main application in IPA')
        info = plistlib.loads(archive.read(infos[0]))
        version = info['CFBundleShortVersionString']
        build = info['CFBundleVersion']
        if not tag.startswith(f'v{version}') or tag[len(version) + 1:][:1] not in ('', '-', '+'):
            raise ValueError('IPA version does not match release tag')
        if info['CFBundleIdentifier'] != 'com.lonzzi.nekofin':
            raise ValueError('Expected the production bundle identifier')
        if not re.fullmatch(r'[1-9]\d{0,3}(?:\.(?:0|[1-9]\d?)){0,2}', build):
            raise ValueError('Invalid iOS build number')
        privacy = {}
        for name in archive.namelist():
            if name == infos[0] or re.fullmatch(r'Payload/[^/]+\.app/PlugIns/[^/]+\.appex/Info\.plist', name):
                plist = plistlib.loads(archive.read(name))
                privacy.update({key: value for key, value in plist.items() if key.startswith('NS') and key.endswith('UsageDescription') and isinstance(value, str)})
    entitlements = set()
    for file in entitlement_files:
        with open(file, 'rb') as handle:
            entitlements.update(plistlib.load(handle))
    entitlements -= {'application-identifier', 'com.apple.developer.team-identifier'}
    return {
        'tag': tag, 'bundleIdentifier': info['CFBundleIdentifier'],
        'version': version, 'buildVersion': build,
        'marketingVersion': tag[1:], 'minOSVersion': info['MinimumOSVersion'],
        'size': Path(ipa).stat().st_size,
        'appPermissions': {'entitlements': sorted(entitlements), 'privacy': privacy},
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('ipa')
    parser.add_argument('tag')
    parser.add_argument('output')
    parser.add_argument('--entitlements', action='append', default=[])
    args = parser.parse_args()
    metadata = extract(args.ipa, args.tag, args.entitlements)
    Path(args.output).write_text(json.dumps(metadata, indent=2) + '\n')
