// 동적 import를 위한 유틸리티 함수들
// 대용량 라이브러리를 필요할 때만 로드하여 초기 번들 크기를 줄입니다.

// ECharts 관련 동적 import
export const loadECharts = () => import(/* webpackChunkName: "echarts" */ 'echarts');
export const loadEChartsForReact = () => import(/* webpackChunkName: "echarts-react" */ 'echarts-for-react');
export const loadEChartsGL = () => import(/* webpackChunkName: "echarts-gl" */ 'echarts-gl');

// Ace Editor 관련 동적 import
export const loadAceEditor = () => import(/* webpackChunkName: "ace-editor" */ 'react-ace');
export const loadAceBuilds = () => import(/* webpackChunkName: "ace-builds" */ 'ace-builds');
export const loadAceMode = (mode: string) => 
  import(/* webpackChunkName: "ace-mode-[request]" */ `ace-builds/src-noconflict/mode-${mode}`);
export const loadAceTheme = (theme: string) => 
  import(/* webpackChunkName: "ace-theme-[request]" */ `ace-builds/src-noconflict/theme-${theme}`);

// React Grid Layout 관련 동적 import
export const loadReactGridLayout = () => import(/* webpackChunkName: "react-grid-layout" */ 'react-grid-layout');

// MathJS 관련 동적 import
export const loadMathJS = () => import(/* webpackChunkName: "mathjs" */ 'mathjs');

// Swiper 관련 동적 import
export const loadSwiper = () => import(/* webpackChunkName: "swiper" */ 'swiper/react');
export const loadSwiperModules = () => import(/* webpackChunkName: "swiper-modules" */ 'swiper');

// React Colorful 동적 import (필요시 패키지 설치 후 사용)
// export const loadReactColorful = () => import(/* webpackChunkName: "react-colorful" */ 'react-colorful');

// Lodash 개별 함수 동적 import
export const loadLodashDebounce = () => import(/* webpackChunkName: "lodash-debounce" */ 'lodash/debounce');
export const loadLodashThrottle = () => import(/* webpackChunkName: "lodash-throttle" */ 'lodash/throttle');
export const loadLodashMerge = () => import(/* webpackChunkName: "lodash-merge" */ 'lodash/merge');
export const loadLodashCloneDeep = () => import(/* webpackChunkName: "lodash-clonedeep" */ 'lodash/cloneDeep');