#!/usr/bin/env python3
"""
Pretendard 폰트 서브셋 생성 스크립트

분석된 문자 사용량을 바탕으로 최적화된 Pretendard 폰트 서브셋을 생성합니다.
fonttools pyftsubset을 사용하여 WOFF2 포맷으로 압축하여 파일 크기를 최소화합니다.
"""

import os
import sys
import json
import subprocess
from pathlib import Path

# 필요한 라이브러리 확인
try:
    from fontTools.subset import main as pyftsubset
    from fontTools.ttLib import TTFont
except ImportError:
    print("❌ fonttools가 설치되지 않았습니다.")
    print("다음 명령어로 설치해주세요: pip install fonttools[woff]")
    sys.exit(1)

class PretendardSubsetGenerator:
    def __init__(self, script_dir):
        self.script_dir = Path(script_dir)
        self.project_root = self.script_dir.parent
        self.fonts_dir = self.project_root / "src" / "assets" / "fonts"
        self.subset_chars_file = self.script_dir / "font-subset-chars.txt"
        self.report_file = self.script_dir / "font-usage-report.json"
        
        # Pretendard 폰트 weight 정의
        self.font_weights = {
            'Thin': 100,
            'ExtraLight': 200,
            'Light': 300,
            'Regular': 400,
            'Medium': 500,
            'SemiBold': 600,
            'Bold': 700,
            'ExtraBold': 800,
            'Black': 900
        }
        
        # 우선순위 weight (자주 사용되는 것들)
        self.priority_weights = ['Regular', 'Medium', 'SemiBold', 'Bold']
        
    def load_subset_characters(self):
        """분석된 서브셋 문자 로드"""
        try:
            with open(self.subset_chars_file, 'r', encoding='utf-8') as f:
                chars = f.read().strip()
            print(f"✅ 서브셋 문자 로드됨: {len(chars)}개 문자")
            return chars
        except FileNotFoundError:
            print("❌ font-subset-chars.txt 파일을 찾을 수 없습니다.")
            print("먼저 analyze-font-usage.js를 실행해주세요.")
            sys.exit(1)
    
    def get_original_font_path(self, weight_name):
        """원본 Pretendard 폰트 파일 경로 찾기"""
        possible_paths = [
            # 시스템 폰트 경로들
            f"/System/Library/Fonts/Pretendard-{weight_name}.otf",
            f"/usr/share/fonts/truetype/pretendard/Pretendard-{weight_name}.ttf",
            # 프로젝트 내 원본 폰트 (있다면)
            self.fonts_dir / "original" / f"Pretendard-{weight_name}.otf",
            self.fonts_dir / "original" / f"Pretendard-{weight_name}.ttf",
            # 다운로드 받은 폰트
            self.script_dir / "pretendard-fonts" / f"Pretendard-{weight_name}.otf",
        ]
        
        for path in possible_paths:
            if Path(path).exists():
                return str(path)
        
        return None
    
    def download_pretendard_fonts(self):
        """Pretendard 폰트 다운로드 (필요시)"""
        fonts_download_dir = self.script_dir / "pretendard-fonts"
        
        if fonts_download_dir.exists():
            print("📁 Pretendard 폰트 디렉토리가 이미 존재합니다.")
            return
            
        print("📥 Pretendard 폰트 다운로드 중...")
        fonts_download_dir.mkdir(exist_ok=True)
        
        # GitHub Release에서 다운로드
        download_url = "https://github.com/orioncactus/pretendard/releases/latest/download/Pretendard.zip"
        zip_path = fonts_download_dir / "Pretendard.zip"
        
        try:
            import urllib.request
            urllib.request.urlretrieve(download_url, zip_path)
            
            # 압축 해제
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(fonts_download_dir)
            
            # 필요한 .otf 파일들을 찾아서 이동
            for weight_name in self.font_weights.keys():
                for root, dirs, files in os.walk(fonts_download_dir):
                    for file in files:
                        if file == f"Pretendard-{weight_name}.otf":
                            src = os.path.join(root, file)
                            dst = fonts_download_dir / file
                            if not dst.exists():
                                os.rename(src, dst)
            
            # zip 파일 삭제
            zip_path.unlink()
            print("✅ Pretendard 폰트 다운로드 완료")
            
        except Exception as e:
            print(f"❌ 폰트 다운로드 실패: {e}")
            print("수동으로 Pretendard 폰트를 다운로드하여 scripts/pretendard-fonts/ 디렉토리에 .otf 파일들을 배치해주세요.")
    
    def create_subset(self, weight_name, subset_chars, output_dir):
        """개별 weight의 서브셋 생성"""
        original_font = self.get_original_font_path(weight_name)
        
        if not original_font:
            print(f"⚠️  {weight_name} 폰트를 찾을 수 없습니다. 스킵합니다.")
            return False
        
        print(f"🔄 {weight_name} 서브셋 생성 중...")
        
        # 출력 파일 경로
        woff2_output = output_dir / "woff2-subset" / f"Pretendard-{weight_name}.subset.woff2"
        woff_output = output_dir / "woff-subset" / f"Pretendard-{weight_name}.subset.woff"
        
        # 출력 디렉토리 생성
        woff2_output.parent.mkdir(parents=True, exist_ok=True)
        woff_output.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # WOFF2 서브셋 생성
            subprocess.run([
                'pyftsubset',
                original_font,
                f'--text={subset_chars}',
                '--layout-features=*',
                '--glyph-names',
                '--symbol-cmap',
                '--legacy-cmap',
                '--notdef-glyph',
                '--notdef-outline',
                '--recommended-glyphs',
                '--name-legacy',
                '--drop-tables+=DSIG',
                '--flavor=woff2',
                f'--output-file={woff2_output}'
            ], check=True, capture_output=True)
            
            # WOFF 서브셋 생성 (폴백용)
            subprocess.run([
                'pyftsubset',
                original_font,
                f'--text={subset_chars}',
                '--layout-features=*',
                '--glyph-names',
                '--symbol-cmap',
                '--legacy-cmap',
                '--notdef-glyph',
                '--notdef-outline',
                '--recommended-glyphs',
                '--name-legacy',
                '--drop-tables+=DSIG',
                '--flavor=woff',
                f'--output-file={woff_output}'
            ], check=True, capture_output=True)
            
            # 파일 크기 확인
            original_size = os.path.getsize(original_font)
            woff2_size = os.path.getsize(woff2_output)
            woff_size = os.path.getsize(woff_output)
            
            reduction_woff2 = ((original_size - woff2_size) / original_size) * 100
            reduction_woff = ((original_size - woff_size) / original_size) * 100
            
            print(f"  ✅ {weight_name} 완료:")
            print(f"    - 원본: {original_size:,} bytes")
            print(f"    - WOFF2: {woff2_size:,} bytes ({reduction_woff2:.1f}% 감소)")
            print(f"    - WOFF: {woff_size:,} bytes ({reduction_woff:.1f}% 감소)")
            
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ {weight_name} 서브셋 생성 실패: {e}")
            return False
        except Exception as e:
            print(f"❌ {weight_name} 처리 중 오류: {e}")
            return False
    
    def generate_all_subsets(self):
        """모든 weight의 서브셋 생성"""
        print("🚀 Pretendard 폰트 서브셋 생성 시작\n")
        
        # 필요한 도구 확인
        try:
            subprocess.run(['pyftsubset', '--help'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ pyftsubset이 설치되지 않았습니다.")
            print("다음 명령어로 설치해주세요: pip install fonttools[woff]")
            return False
        
        # 서브셋 문자 로드
        subset_chars = self.load_subset_characters()
        
        # 폰트 다운로드 (필요시)
        self.download_pretendard_fonts()
        
        # 서브셋 생성
        successful = 0
        total = len(self.font_weights)
        
        # 우선순위 weight 먼저 처리
        for weight_name in self.priority_weights:
            if weight_name in self.font_weights:
                if self.create_subset(weight_name, subset_chars, self.fonts_dir):
                    successful += 1
        
        # 나머지 weight 처리
        for weight_name in self.font_weights:
            if weight_name not in self.priority_weights:
                if self.create_subset(weight_name, subset_chars, self.fonts_dir):
                    successful += 1
        
        print(f"\n🎉 서브셋 생성 완료: {successful}/{total} 성공")
        
        if successful > 0:
            self.generate_css_unicode_ranges()
            return True
        
        return False
    
    def generate_css_unicode_ranges(self):
        """CSS @font-face용 unicode-range 생성"""
        subset_chars = self.load_subset_characters()
        
        # 문자들을 Unicode 코드포인트로 변환
        code_points = sorted([ord(char) for char in subset_chars])
        
        # 연속된 범위로 그룹화
        ranges = []
        start = code_points[0]
        end = code_points[0]
        
        for i in range(1, len(code_points)):
            if code_points[i] == end + 1:
                end = code_points[i]
            else:
                if start == end:
                    ranges.append(f"U+{start:04X}")
                else:
                    ranges.append(f"U+{start:04X}-{end:04X}")
                start = end = code_points[i]
        
        # 마지막 범위 추가
        if start == end:
            ranges.append(f"U+{start:04X}")
        else:
            ranges.append(f"U+{start:04X}-{end:04X}")
        
        unicode_range = ", ".join(ranges)
        
        # CSS 업데이트 권장사항 저장
        css_recommendation = f"""
/* 최적화된 unicode-range for Pretendard subset */
/* 생성된 서브셋에 포함된 문자 범위: {len(subset_chars)}개 문자 */
unicode-range: {unicode_range};

/* index.css에서 기존 unicode-range를 위 값으로 교체하세요 */
"""
        
        css_file = self.script_dir / "optimized-unicode-range.css"
        with open(css_file, 'w', encoding='utf-8') as f:
            f.write(css_recommendation)
        
        print(f"📝 최적화된 Unicode 범위 저장됨: {css_file}")

def main():
    script_dir = Path(__file__).parent
    generator = PretendardSubsetGenerator(script_dir)
    
    success = generator.generate_all_subsets()
    
    if success:
        print("\n✅ 폰트 최적화 완료!")
        print("📋 다음 단계:")
        print("1. 생성된 서브셋 폰트 파일 확인")
        print("2. index.css의 unicode-range 업데이트")
        print("3. 브라우저에서 폰트 로딩 테스트")
        print("4. Lighthouse 성능 측정")
    else:
        print("\n❌ 폰트 최적화 실패")
        print("로그를 확인하고 문제를 해결한 후 다시 시도해주세요.")

if __name__ == "__main__":
    main()