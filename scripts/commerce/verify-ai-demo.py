#!/usr/bin/env python3
"""Explicit live LLM demo acceptance; use a dedicated LOCAL test account.

Creates/reuses that account's bundled sample, generates two real Codex drafts,
saves and re-reads them, and restores its original presentation in finally.
No provider mocks, model fallback, source replacement, or data deletion.
"""
import argparse
import copy
import json
import os
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', required=True)
    parser.add_argument('--user-id', required=True)
    parser.add_argument('--password-env', default='COMMERCE_VERIFY_PASSWORD')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    base = args.api_url.rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.username or parsed.password:
        parser.error('This mutating acceptance script requires a local API and dedicated test account.')
    password = os.environ.get(args.password_env)
    if not password:
        parser.error('Missing password environment variable.')
    token = None
    calls = []

    def api(path, body=None, method=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        request = Request(base + path, headers=headers, method=method,
                          data=json.dumps(body).encode() if body is not None else None)
        started = time.monotonic()
        with urlopen(request, timeout=190) as response:
            value = json.load(response)
            # Never retain authentication bodies or credentials.
            if not path.startswith('/login/'):
                calls.append(dict(path=path, status=response.status,
                                  durationSeconds=round(time.monotonic()-started, 2)))
            return value

    def immutable(report):
        value = copy.deepcopy(report)
        value['project'].pop('presentation', None)
        return value

    token = api('/login/signin', {'userId': args.user_id, 'password': password})['accessToken']
    project = api('/commerce/sample', {})['data']['projectId']
    root = f'/commerce/{project}'
    baseline = api(root + '/report')['data']
    original = baseline['project']['presentation']
    original_for_save = {key: original.get(key, '') for key in ('title', 'explanation', 'chartTitle')}
    current = original
    cases = []
    prompts = [
        ('all', '', '대시보드 제목을 매출·환불 운영 현황으로 바꾸고, 세금·배송 포함 차감 수취액과 주문일 코호트 환불률의 차이를 설명해 줘. 금액과 계산식은 변경하지 마.'),
        ('cohort-question', '?start=2025-06-24&end=2025-06-24', '현재 조회 범위는 2025-06-24 하루야. 환불액이 0달러인데 환불 주문 비율은 100%인 이유를 운영 담당자가 이해하도록 두 문장으로 설명해 줘. 환불 처리일과 주문일 코호트의 차이, 확보한 데이터 범위 내 환불 이력임을 포함해. 제목은 매출·환불 운영 현황으로 유지하고 금액과 계산식은 변경하지 마.'),
    ]
    modified = False
    try:
        for label, query, prompt in prompts:
            before = api(root + '/report' + query)['data']
            if query:
                assert before['summary']['refundTotal'] == '0.00'
                assert before['summary']['refundOrderRate'] == 1
            body = dict(prompt=prompt, currentPresentation=current)
            if query:
                body.update(start='2025-06-24', end='2025-06-24')
            answer = api(root + '/ai', body)['data']
            assert answer['requestedModel'] == 'gpt-6-luna'
            draft = answer['draft']
            assert all(isinstance(draft.get(k), str) and draft[k].strip() for k in original_for_save)
            assert draft['title'] == '매출·환불 운영 현황'
            assert '주문' in draft['explanation'] and '환불' in draft['explanation']
            assert '데이터' in draft['explanation'] and '평생' not in draft['explanation']
            assert '환불률' not in draft['chartTitle'] and '환불 주문 비율' not in draft['chartTitle']
            assert 'USD' in draft['chartTitle']
            if query:
                assert '100%' in draft['explanation'] and '0' in draft['explanation']
                assert '기준' in draft['explanation'], 'Explanation must distinguish the date bases'
            # Preview is not persistence; cancel can discard this without a write.
            assert api(root + '/report' + query)['data'] == before
            modified = True
            api(root + '/presentation', {'presentation': draft}, method='PUT')
            saved = api(root + '/report' + query)['data']
            assert saved['project']['presentation'] == draft
            assert immutable(saved) == immutable(before), 'AI changed report data or publication identity'
            assert api(root + '/report' + query)['data'] == saved
            cases.append(dict(case=label, prompt=prompt, answer=answer,
                              summary=saved['summary'], previewUnpersisted=True,
                              saveReload=True, reportUnchanged=True))
            current = draft
    finally:
        if modified:
            api(root + '/presentation', {'presentation': original_for_save}, method='PUT')
    restored = api(root + '/report')['data']
    assert immutable(restored) == immutable(baseline)
    assert restored['project']['presentation'] == original_for_save
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dict(projectId=project, cases=cases, calls=calls,
                                         originalPresentationRestored=True), ensure_ascii=False, indent=2) + '\n')
    print('PASS: 2 real gpt-6-luna questions, preview isolation, save/re-read, unchanged report/digest/version; presentation restored')


if __name__ == '__main__':
    main()
