import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { databaseLogos, featureCards, images } from './content';

// ViewBox/FeatureBox가 공유하는 히어로 타이포(기존 .typo 규칙)와 버튼 규격.
const heroTypoClassName =
  'text-center font-bold leading-[1.29] tracking-[-1.02px] text-white [text-shadow:0_0.8px_1.5px_rgba(18,0,88,0.4)]';
const ctaButtonClassName =
  'h-10 w-[120px] gap-2 text-sm font-bold shadow-[0_4px_6px_0_rgba(26,33,97,0.2)] md:h-[46px] md:w-[140px] md:text-base';
const detailTitleClassName = 'text-[26px] font-bold leading-[1.31] tracking-[-0.64px] text-primary md:text-[32px]';
const detailBodyClassName =
  'mt-3 mb-4 text-sm leading-[1.63] text-foreground lg:mt-[18px] lg:mb-0 lg:text-[15px] xl:text-base';
const detailImageClassName = 'w-full lg:w-[514px] lg:shrink-0 xl:w-[700px]';

export default function App() {
  return (
    <div id="wrap" className="min-w-[320px] bg-background">
      <header id="headBox" className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background">
        <nav className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-4 md:px-6">
          <a href="./" className="flex h-full items-center">
            <h1 className="sr-only">VanillaMeta</h1>
            <img className="h-5 w-[105px]" src={images.logo} alt="VanillaMeta Logo" />
          </a>
          <Button asChild variant="ghost" size="icon-lg">
            <a href="https://github.com/vanillabrain/vanillameta" target="_blank" rel="noopener noreferrer">
              <img className="size-6" src={images.github} alt="Github Logo" />
            </a>
          </Button>
        </nav>
      </header>

      <main>
        <section id="viewBox" className="w-full">
          <div className="flex flex-col items-center bg-[#eceef3] bg-[linear-gradient(to_bottom,#264e9c_0%,#b3d5f3_54%,rgba(255,255,255,0)_100%)] px-4 pt-12 pb-12 md:px-6 md:pt-16 md:pb-16">
            <h2 className={`${heroTypoClassName} text-[32px] md:text-5xl`}>
              누구나 쉽게 사용하는
              <br />
              통합 데이터 분석
            </h2>
            <p className={`${heroTypoClassName} mt-[7px] text-sm md:text-lg`}>VanillaMeta with open source on Github</p>
            <div className="mt-[26px] flex gap-2 md:mt-8 md:gap-3">
              <Button asChild size="lg" className={ctaButtonClassName}>
                <a href="https://vanillameta.vanillabrain.com" target="_blank" rel="noopener noreferrer">
                  <img className="h-[22px] w-auto md:h-6" src={images.vanillaMeta} alt="Vanilla meta button icon" />
                  데모 보기
                </a>
              </Button>
              <Button asChild size="lg" className={ctaButtonClassName}>
                <a href="https://github.com/vanillabrain/vanillameta" target="_blank" rel="noopener noreferrer">
                  <img className="h-[22px] w-auto md:h-6" src={images.githubWhite} alt="Github button icon" />
                  소스 보기
                </a>
              </Button>
            </div>
            <div className="flex w-full justify-center">
              <img className="mt-[30px] w-full max-w-[772px] md:mt-4" src={images.mainVisual} alt="" />
            </div>
          </div>
        </section>

        <section id="featureBox" className="bg-[#eceef3] pb-[60px] text-center md:pb-20">
          <div className="px-[45px]">
            <h2 className="text-[26px] font-bold tracking-[0.36px] text-primary md:text-[36px]">Why VanillaMeta?</h2>
          </div>
          <div className="px-5">
            <p className="mt-3 mb-9 text-sm leading-[22px] text-foreground md:text-base">
              바닐라메타는 최신 데이터 탐색적 분석 및 데이터 시각화 솔루션입니다.
              <br />
              비즈니스 인텔리전스 도구를 대체하거나 보강할 수 있으며, 다양한 데이터 소스와 잘 통합 됩니다.
              <br />
              <span className="text-[#0f5ab2]">
                이러한 바닐라메타는 Github에서 Open Sorce로 제공 받아 사용하실 수 있습니다.
              </span>
            </p>
          </div>
          <div className="px-5 md:px-6">
            <ul className="mx-auto grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:max-w-[1220px] md:gap-6 lg:grid-cols-3">
              {featureCards.map(card => (
                <li key={card.alt} className="flex">
                  <Card className="w-full [--card-spacing:24px] md:min-h-[292px]">
                    <div className="flex flex-1 flex-col items-center px-6 text-center">
                      <h3 className="mb-[14px] text-[15px] font-bold leading-[1.33] tracking-[-0.18px] text-primary md:text-lg">
                        {card.title[0]} <br className="md:hidden" />
                        {card.title[1]}
                      </h3>
                      <p className="mb-6 text-sm leading-6 text-muted-foreground">
                        {card.description[0]} <br />
                        {card.description[1]}
                      </p>
                      <img className="mt-auto h-auto w-full max-w-[214px] object-contain" src={card.image} alt={card.alt} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="detailBox"
          className="px-5 pt-[60px] pb-[62px] text-center md:px-6 md:pt-[72px] md:pb-[70px] lg:text-left"
        >
          <h2 className="sr-only">VanillaMeta feature detail</h2>
          <ul className="mx-auto flex max-w-[1050px] flex-col items-center gap-y-12 md:gap-y-16">
            <li className="flex w-full flex-col items-center lg:flex-row lg:items-start lg:justify-between">
              <div className="lg:flex-1">
                <h3 className={detailTitleClassName}>대시보드 분석 시각화</h3>
                <p className={detailBodyClassName}>
                  사용자 맞춤형 대시보드 편집 및 공유와
                  <br />
                  대시보드 템플릿 디자인을 추천합니다.
                </p>
              </div>
              <img className={detailImageClassName} src={images.detail01} alt="Feature detail img thumbnail 01" />
            </li>
            <li className="flex w-full flex-col items-center lg:flex-row lg:items-start lg:justify-between">
              <div className="lg:flex-1">
                <h3 className={detailTitleClassName}>시각화 위젯 제작</h3>
                <p className={detailBodyClassName}>
                  코딩없이 차트 위젯 제작 가능하며
                  <br />
                  50개 이상의 차트를 지원합니다.
                </p>
              </div>
              <img className={detailImageClassName} src={images.detail02} alt="Feature detail img thumbnail 01" />
            </li>
            <li className="flex w-full flex-col items-center lg:flex-row lg:items-start lg:justify-between">
              <div className="lg:flex-1">
                <h3 className={detailTitleClassName}>
                  최신 데이터베이스와 <br className="hidden lg:block" />
                  통합
                </h3>
                <p className={detailBodyClassName}>
                  고급 SQL 쿼리 편집기 및 데이터 미리보기
                  <br className="hidden lg:block" />가 가능하며, <br className="lg:hidden" />
                  다양한 SQL 데이터베이스에 <br className="hidden lg:block" />
                  대해 즉시 지원합니다.
                </p>
              </div>
              <img className={detailImageClassName} src={images.detail03} alt="Feature detail img thumbnail 01" />
            </li>
          </ul>
        </section>

        <section id="bannerBox" className="bg-[#f3f7fb] px-4 py-[55px] text-center md:px-0 md:pt-[60px] md:pb-[62px]">
          <h2 className="mb-[30px] text-lg font-bold tracking-[-0.18px] text-primary">
            <span className="sr-only">VanillaMeta </span>지원가능 데이터베이스
          </h2>
          <ul className="mx-auto flex max-w-[706px] flex-wrap items-center justify-center gap-y-6 md:justify-between">
            {databaseLogos.map(logo => (
              <li key={logo.alt} className="w-fit">
                <img src={logo.src} alt={logo.alt} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer id="footBox" className="min-h-24">
        <div className="flex h-full items-center justify-center pt-[30px] pr-[23px] pb-[50px] pl-[50px] md:px-0 md:pt-[44px] md:pb-[47px]">
          <h2 className="sr-only">VanillaMeta information</h2>
          <div className="mr-[46px]">
            <a href="./">
              <img className="w-[98px]" src={images.logo} alt="VanillaMeta" />
            </a>
          </div>
          <div className="text-xs text-muted-foreground md:text-[13px]">
            <p>
              Copyright{' '}
              <a href="https://vanillabrain.com" target="_blank" rel="noopener noreferrer">
                <span className="font-bold">©VanillaBrain Inc. </span>
              </a>
              <br className="sm:hidden" />
              All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
