create table if not exists component
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '컴포넌트 ID'
        primary key,
    type varchar(45) not null comment '타입 코드',
    title varchar(100) not null comment '타입명',
    description varchar(300) null comment '설명',
    category varchar(45) null comment '분류',
    `option` text not null comment '컴포넌트 속성',
    icon varchar(45) null comment '컴포넌트 아이콘 경로',
    seq int null comment '순서',
    useYn varchar(1) default 'Y' not null comment '사용여부',
    constraint IDX_9fe1f6a769df8035b25b0d8070
        unique (type)
);

create table if not exists dashboard
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '대시보드 ID'
        primary key,
    title varchar(300) not null comment '대시보드명',
    templateId int null comment '템플릿 ID',
    layout text null comment '레이아웃 정보',
    seq int null comment '순서',
    delYn varchar(1) default 'N' not null comment '삭제여부'
);

create table if not exists dashboard_widget
(
    dashboardId int not null,
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment
        primary key,
    widgetId int not null
);

create table if not exists `database`
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '데이터베이스 ID'
        primary key,
    name varchar(300) not null comment '데이터베이스명',
    description varchar(1000) null comment '설명',
    connectionConfig text not null comment '속성',
    engine varchar(100) not null comment '데이터베이스 구분',
    timezone varchar(100) null comment '타임존'
);

create table if not exists databaseType
(
    createdAt datetime(6) default (now(6)) not null comment '생성일',
    updatedAt datetime(6) default (now(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '데이터베이스 타입 ID'
        primary key,
    type varchar(45) not null comment '타입 코드',
    title varchar(100) not null comment '타입명',
    seq int null comment '순서',
    useYn varchar(1) default 'Y' not null comment '사용여부',
    constraint type
        unique (type)
);

create table if not exists dataset
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '데이터셋 ID'
        primary key,
    title varchar(255) null comment '데이터셋명',
    databaseId int not null comment '데이터베이스 ID',
    query text not null comment '조회 sql'
);

create table if not exists table_query
(
    createdAt datetime(6) default (now(6)) not null comment '생성일',
    updatedAt datetime(6) default (now(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '위젯 데이터셋 ID'
        primary key,
    databaseId int not null comment '데이터베이스 ID',
    query text not null comment '조회 sql'
);

create table if not exists template
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '템플릿 ID'
        primary key,
    title varchar(300) null comment '템플릿명',
    description varchar(1000) null comment '템플릿 설명',
    useYn varchar(1) default 'Y' not null comment '사용여부'
);

create table if not exists template_item
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '템플릿 아이템 ID'
        primary key,
    templateId int not null comment '템플릿 ID',
    x int not null comment 'x좌표 값',
    y int not null comment 'y좌표 값',
    width int not null comment '너비',
    height int not null comment '높이',
    recommendCategory varchar(45) null comment '컴포넌트 분류',
    recommendType varchar(45) null comment '컴포넌트 타입 코드',
    constraint FK_cce2beaf0ceb340c67c602206e1
        foreign key (templateId) references template (id)
);

create table if not exists widget
(
    createdAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null comment '생성일',
    updatedAt datetime(6) default (CURRENT_TIMESTAMP(6)) not null on update CURRENT_TIMESTAMP(6) comment '수정일',
    id int auto_increment comment '위젯 ID'
        primary key,
    title varchar(300) null comment '위젯명',
    description varchar(1000) null comment '설명',
    componentId int not null comment '컴포넌트 ID',
    datasetType varchar(255) default 'WIDGET_VIEW' not null comment '데이터셋 구분(데이터셋, 위젯 뷰)',
    datasetId int not null comment '데이터셋 ID',
    `option` text not null comment '위젯 속성',
    delYn varchar(1) default 'N' not null comment '삭제여부',
    constraint FK_30bbe9afcbb39f1c40b74bbb320
        foreign key (componentId) references component (id)
);

