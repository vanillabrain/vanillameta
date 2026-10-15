// 랜딩 페이지 정적 이미지/콘텐츠. 이미지 파일은 기존 landing-page/img 위치를 그대로 유지한다.
import icGithubWhite from '../img/ic-github-white.svg';
import icGithub from '../img/ic-github.svg';
import icVanillaMeta from '../img/ic-vanilla-meta.svg';
import detail01 from '../img/img-01.png';
import detail02 from '../img/img-02.png';
import detail03 from '../img/img-03.png';
import logoBigquery from '../img/logo-bigquery.png';
import logoCockroachdb from '../img/logo-cockroachdb.png';
import logoMariaDb from '../img/logo-maria-db.png';
import logoMssql from '../img/logo-mssql.png';
import logoMysql from '../img/logo-mysql.png';
import logoOracle from '../img/logo-oracle.png';
import logoPostgresql from '../img/logo-postgresql.png';
import logoRedshift from '../img/logo-redshift.png';
import logoSnowflake from '../img/logo-snowflake.png';
import logoSqllite from '../img/logo-sqllite.png';
import mainVisual from '../img/main-visual.png';
import thumb01 from '../img/thumb-01.png';
import thumb02 from '../img/thumb-02.png';
import thumb03 from '../img/thumb-03.png';
import thumb04 from '../img/thumb-04.png';
import thumb05 from '../img/thumb-05.png';
import thumb06 from '../img/thumb-06.png';
import vanillaMetaLogo from '../img/vanilla-meta-logo.png';

export const images = {
  logo: vanillaMetaLogo,
  mainVisual,
  github: icGithub,
  githubWhite: icGithubWhite,
  vanillaMeta: icVanillaMeta,
  detail01,
  detail02,
  detail03,
};

export type FeatureCard = {
  title: [string, string];
  description: [string, string];
  image: string;
  alt: string;
};

// 제목/설명의 두 번째 줄은 좁은 화면에서만 줄바꿈으로 보인다(기존 br 예외 클래스와 동일).
export const featureCards: FeatureCard[] = [
  {
    title: ['코딩없이 차트', '위젯 제작'],
    description: ['연결된 데이터베이스를 지원하는 차트 중 선택 후', '설정화면을 통해 코딩없이 위젯 제작이 가능합니다.'],
    image: thumb01,
    alt: 'Feature image thumbnail 01',
  },
  {
    title: ['50개 이상의', '차트 지원'],
    description: ['50개 이상의 다양한 차트 지원으로', '최적의 분석을 위한 차트 활용이 가능합니다.'],
    image: thumb02,
    alt: 'Feature image thumbnail 02',
  },
  {
    title: ['사용자 맞춤형', '대시보드 편집 및 공유'],
    description: ['사용자가 설정한 위젯을 자유로운', '레이아웃으로 편집 및 공유가 가능합니다.'],
    image: thumb03,
    alt: 'Feature image thumbnail 03',
  },
  {
    title: ['대시보드 템플릿', '디자인 추천'],
    description: ['대시보드 템플릿 디자인 추천을 통해', '빠르고 편리하게 편집이 가능합니다.'],
    image: thumb04,
    alt: 'Feature image thumbnail 04',
  },
  {
    title: ['SQL 쿼리 편집기 &', '데이터 미리보기 제공'],
    description: ['SQL 쿼리 편집기를 통해 빠르게 데이터를 편집하고', '미리보기를 통해 데이터를 확인할 수 있습니다.'],
    image: thumb05,
    alt: 'Feature image thumbnail 05',
  },
  {
    title: ['다양한 SQL', '데이터베이스 즉시 지원'],
    description: ['다양한 SQL 데이터베이스 지원 기능을 통해', '빠르게 데이터를 연결할 수 있습니다.'],
    image: thumb06,
    alt: 'Feature image thumbnail 06',
  },
];

export const databaseLogos: { src: string; alt: string }[] = [
  { src: logoMysql, alt: 'MySQL banner image' },
  { src: logoMariaDb, alt: 'MariaDB banner image' },
  { src: logoPostgresql, alt: 'PostgreSQL banner image' },
  { src: logoOracle, alt: 'Oracle banner image' },
  { src: logoRedshift, alt: 'Amazon Redshift banner image' },
  { src: logoBigquery, alt: 'Google Big Query banner image' },
  { src: logoSqllite, alt: 'SQLite banner image' },
  { src: logoMssql, alt: 'Microsoft SQL Server banner image' },
  { src: logoSnowflake, alt: 'Snowflake banner image' },
  { src: logoCockroachdb, alt: 'Cockroach banner image' },
];
