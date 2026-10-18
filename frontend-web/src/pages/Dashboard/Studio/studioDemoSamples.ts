/** VM-owned fixtures and attributed reference sources; selection never invokes AI. */
export type StudioSampleId = 'commerce' | 'margin' | 'funnel' | 'rill';
export const studioDemoSamples: { id: StudioSampleId; title: string; description: string; scope: string }[] = [
  {
    id: 'commerce',
    title: '매출·환불 샘플',
    description: '결제 성공액·환불액·주문 기준을 확인하는 첫 분석',
    scope: '공개 합성 데이터 · 37주문',
  },
  {
    id: 'margin',
    title: '비용·마진 샘플',
    description: '고객별 매출과 비용, 이익과 마진을 비교하는 분석',
    scope: 'VM 합성 데모 · USD · 0매출·적자 포함',
  },
  {
    id: 'funnel',
    title: '앱 전환 샘플',
    description: '버전·기기별 방문과 다운로드, 가입 전환율 분석',
    scope: 'VM 합성 데모 · 단계별 집계 데이터',
  },
  {
    id: 'rill',
    title: 'Rill 광고 샘플',
    description: '기기별 요청 수와 평균 입찰 하한을 살펴보는 분석',
    scope: 'Rill 공식 데이터 · 139만 행',
  },
];
