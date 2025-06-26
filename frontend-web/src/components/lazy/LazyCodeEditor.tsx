import React, { Suspense, lazy } from 'react';
import { LoadingWithIcon } from '@/components/loading';

// Ace Editor를 레이지 로드
const AceEditor = lazy(() => 
  import(/* webpackChunkName: "ace-editor-component" */ 'react-ace').then(module => {
    // 필요한 모드와 테마도 함께 로드
    return Promise.all([
      import(/* webpackChunkName: "ace-mode-sql" */ 'ace-builds/src-noconflict/mode-sql'),
      import(/* webpackChunkName: "ace-theme-monokai" */ 'ace-builds/src-noconflict/theme-monokai'),
      import(/* webpackChunkName: "ace-ext-language-tools" */ 'ace-builds/src-noconflict/ext-language_tools')
    ]).then(() => module);
  })
);

interface LazyCodeEditorProps {
  mode?: string;
  theme?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  onLoad?: (editor: any) => void;
  fontSize?: number;
  showPrintMargin?: boolean;
  showGutter?: boolean;
  highlightActiveLine?: boolean;
  setOptions?: any;
  style?: React.CSSProperties;
  className?: string;
  editorProps?: any;
  width?: string;
  height?: string;
}

// 에디터 로딩 중 표시할 스켈레톤
const EditorSkeleton = ({ style, className }: { style?: React.CSSProperties; className?: string }) => (
  <div style={{ ...style, backgroundColor: '#272822', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
    <LoadingWithIcon in={true} style={{ opacity: 0.4 }} />
  </div>
);

// Ace Editor를 레이지 로드하는 래퍼 컴포넌트
export const LazyCodeEditor: React.FC<LazyCodeEditorProps> = (props) => {
  return (
    <Suspense fallback={<EditorSkeleton style={props.style} className={props.className} />}>
      <AceEditor {...props} />
    </Suspense>
  );
};

export default LazyCodeEditor;