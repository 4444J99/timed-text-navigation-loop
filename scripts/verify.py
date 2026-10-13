#!/usr/bin/env python3
"""Verify the bounded historical extraction, without third-party dependencies."""
from __future__ import annotations

import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'


def require(condition, description):
    if not condition:
        raise AssertionError(description)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


class Dependencies(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.timers = []
        self.scripts = []
        self.links = []
        self.in_script = False
        self.script_text = ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a':
            self.links.append(attrs)
        for key in ('src', 'poster'):
            if attrs.get(key):
                self.references.append(attrs[key])
        if tag in ('link', 'a') and attrs.get('href'):
            self.references.append(attrs['href'])
        if 'onload' in attrs:
            self.timers.append(attrs['onload'])
        if tag == 'script':
            self.in_script = True
            self.script_text = ''

    def handle_data(self, data):
        if self.in_script:
            self.script_text += data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False
            self.scripts.append(self.script_text)


def verify_reference(page, reference):
    parsed = urlsplit(reference)
    require(not parsed.netloc and parsed.scheme in ('', 'data'),
            f'External dependency in {page.relative_to(ROOT)}: {reference}')
    if parsed.scheme == 'data' or not parsed.path:
        return False
    require(not parsed.path.startswith('/'), f'Root-absolute path breaks subdirectory hosting: {reference}')
    target = (page.parent / unquote(parsed.path)).resolve()
    require(target.is_relative_to(PUBLIC.resolve()), f'Dependency escapes public/: {reference}')
    require(target.is_file(), f'Missing dependency in {page.relative_to(ROOT)}: {reference}')
    return True


def verify():
    manifest = json.loads((ROOT / 'provenance/source-manifest.json').read_text())
    originals = {}
    for item in manifest['preserved_source_files']:
        data = (ROOT / item['preserved_path']).read_bytes()
        require(len(data) == item['bytes'], f'Source byte length: {item["source_path"]}')
        require(sha256(data) == item['sha256'], f'Source SHA-256: {item["source_path"]}')
        require(blob_sha(data) == item['source_git_blob_sha1'], f'Source Git identity: {item["source_path"]}')
        originals[item['source_path']] = data
    require(len(originals) == 19, 'Nineteen original source files must be preserved')

    body = re.compile(r'<body\b.*?</body>', re.S)
    style = re.compile(r'<style\b[^>]*>(.*?)</style>', re.S)
    title = re.compile(r'<title>(.*?)</title>', re.S)
    for item in manifest['extracted_pages']:
        current = (ROOT / item['path']).read_bytes()
        source = originals[item['source_path']]
        require(sha256(current) == item['standalone_sha256'], f'Extracted file digest: {item["path"]}')
        source, current = source.decode(), current.decode()
        require(body.search(source).group() == body.search(current).group(), f'Body markup changed: {item["path"]}')
        require(style.findall(source) == style.findall(current), f'Inline style changed: {item["path"]}')
        require(title.findall(source) == title.findall(current), f'Title changed: {item["path"]}')

    for path in ['css/normalize.css', 'css/styles_old.css']:
        require((PUBLIC / path).read_bytes() == originals[path], f'Original stylesheet changed: {path}')
    require((PUBLIC/'index.html').read_bytes() == (PUBLIC/'loophole.html').read_bytes(),
            'Root entry must be an exact copy of the historical entrance')

    vendor = json.loads((ROOT/'provenance/bootstrap-provenance.json').read_text())
    for item in vendor['files']:
        data = (PUBLIC/'vendor'/item['path']).read_bytes()
        require(sha256(data) == item['sha256'], f'Vendor SHA-256: {item["path"]}')
        require(blob_sha(data) == item['git_blob_sha1'], f'Vendor Git identity: {item["path"]}')

    checked = 0
    html_files = sorted(PUBLIC.rglob('*.html'))
    require(len(html_files) == 14, 'Thirteen historical routes plus one root entry are required')
    for page in html_files:
        text = page.read_text()
        parser = Dependencies()
        parser.feed(text)
        for reference in parser.references:
            checked += verify_reference(page, reference)
        require(not any(x.strip() for x in parser.scripts), f'Unexpected inline script: {page}')
        if page.parent.name == 'labyrinth':
            require(len(parser.timers) == 1, f'Exactly one load timer expected: {page.name}')
            delay = manifest['timers_ms'][page.stem]
            require(re.fullmatch(r"setTimeout\(function\(\)\{window.location = '\.\./loophole.html';\},\s*" + str(delay) + r'\)',
                                 parser.timers[0]) is not None, f'Return timer changed: {page.name}')
            checked += verify_reference(page, '../loophole.html')
        else:
            require(len(parser.links) == 11, f'Eleven entrance links expected: {page.name}')
            require(all(x.get('onclick') == 'randomlinks()' for x in parser.links),
                    f'Entrance link action changed: {page.name}')

    for css in PUBLIC.rglob('*.css'):
        # Inactive upstream documentation/source-map comments do not initiate
        # stylesheet resource fetches and must not be treated as active URLs.
        active = re.sub(r'/\*.*?\*/', '', css.read_text(), flags=re.S)
        for ref in re.findall(r'url\(\s*[\"\']?([^\"\')]+)[\"\']?\s*\)', active):
            checked += verify_reference(css, ref.strip())
        require(not re.search(r'@import\b', active), f'Unexpected CSS import: {css}')

    js = (PUBLIC/'js/loophole.js').read_text()
    destinations = re.findall(r'"(labyrinth/[^\"]+\.html)"', js)
    require(len(destinations) == 12 and len(set(destinations)) == 12, 'Twelve unique destinations are required')
    for destination in destinations:
        checked += verify_reference(PUBLIC/'loophole.html', destination)
    require(set(destinations) == {'labyrinth/'+x+'.html' for x in manifest['timers_ms']},
            'Every historical chamber must be reachable')
    require(len(list(PUBLIC.rglob('*.js'))) == 1, 'The artwork must have only its own navigation script')
    require((PUBLIC/'labyrinth/041015.html').read_text().count('whereiendandubegin') == 378,
            'All 378 repeated instances must be preserved')
    for name in ['051815', '072716']:
        parsed = Dependencies()
        parsed.feed((PUBLIC/'labyrinth'/f'{name}.html').read_text())
        require(not parsed.references, f'Plain historical chamber acquired a dependency: {name}')

    return {'status': 'passed', 'source_commit': manifest['source_commit'],
            'original_files_verified': len(originals), 'vendor_files_verified': len(vendor['files']),
            'historical_pages': len(manifest['extracted_pages']), 'served_html_routes': len(html_files),
            'resolved_local_references': checked, 'chambers': len(destinations),
            'repeated_text_instances': 378, 'runtime_external_dependencies': 0,
            'scope': 'Source integrity, markup, styles, timers, dependency closure, and route graph. Browser execution is verified separately.'}


if __name__ == '__main__':
    try:
        print(json.dumps(verify(), indent=2))
    except (AssertionError, KeyError, OSError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        sys.exit(1)
