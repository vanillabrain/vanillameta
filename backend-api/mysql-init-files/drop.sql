

create database vanillameta_auth character set utf8mb4 colate utf8mb4_unicode_ci;

USE vanillameta_auth;
)
create table vanillameta_auth.user
(
    id int auto_increment
        primary key,
    email varchar(45) null,
    jwtId varchar(45) null,
    password varchar(45) null,
    createdAt date null,
    updatedAt date null,
    userId varchar(45) null
);

create table component
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    type varchar(50) null,
    title varchar(50) null,
    description varchar(50) null,
    category varchar(50) null,
    `option` varchar(256) null,
    icon varchar(50) null,
    seq int null,
    useYn varchar(50) null
);

create table dashboard
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    title varchar(50) null,
    templateId varchar(50) null,
    layout varchar(1024) null,
    seq varchar(50) null,
    delYn varchar(50) null,
    shareId int null
);

create table dashboard_share
(
    id int auto_increment
        primary key,
    shareToken varchar(255) null,
    shareYn varchar(255) null,
    createdAt datetime null,
    updatedAt datetime null,
    endDate datetime null,
    uuid varchar(255) null
);

create table dashboard_widget
(
    dashboardId int null,
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    widgetId int null
);

create table `database`
(
    id int auto_increment
        primary key,
    type varchar(255) null,
    name varchar(255) null,
    description varchar(255) null,
    connectionConfig varchar(512) null,
    engine varchar(255) null,
    timezone varchar(255) null,
    createdAt date null,
    updatedAt date null
);

create table databaseType
(
    id int auto_increment
        primary key,
    engine varchar(50) null,
    type varchar(50) null,
    title varchar(50) null,
    seq int null,
    useYn varchar(50) null,
    createdAt varchar(50) null,
    updatedAt varchar(50) null
);

create table dataset
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    title varchar(50) null,
    databaseId int null,
    query varchar(128) null
);

create table login_history
(
    loginNo int auto_increment
        primary key,
    userId varchar(45) null,
    loginType varchar(45) null,
    statusCode varchar(45) null,
    createdAt datetime null,
    path varchar(45) null,
    loginSuccYn varchar(45) null
);

create table refresh_token
(
    id int auto_increment
        primary key,
    refreshToken varchar(255) null
);

create table table_query
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    databaseId int null,
    query varchar(50) null
);

create table template
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    title varchar(50) null,
    description varchar(50) null,
    useYn varchar(50) null
);

create table template_item
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    templateId int null,
    x int null,
    y int null,
    width int null,
    height int null,
    recommendCategory varchar(50) null,
    recommendType varchar(50) null
);

create table user
(
    id int auto_increment
        primary key,
    email varchar(45) null,
    jwtId varchar(45) null,
    password varchar(45) null,
    createdAt date null,
    updatedAt date null,
    userId varchar(45) null
);

create table user_mapping
(
    id int auto_increment
        primary key,
    dashboardId varchar(50) null,
    userInfoId varchar(50) null,
    updatedAt date null,
    createdAt date null
);

create table widget
(
    createdAt varchar(50) null,
    updatedAt varchar(50) null,
    id int auto_increment
        primary key,
    title varchar(50) null,
    description varchar(50) null,
    componentId int null,
    datasetType varchar(50) null,
    datasetId int null,
    `option` varchar(1024) null,
    delYn varchar(50) null
);




