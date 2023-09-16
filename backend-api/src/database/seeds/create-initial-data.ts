import {DataSource} from "typeorm";
import {Seeder} from "typeorm-extension"
import {Component} from "../../component/entities/component.entity";
import {DatabaseType} from "../entities/database_type.entity";
import {Template} from "../../template/entities/template.entity";
import {TemplateItem} from "../../template/entities/template-item.entity";
import {User} from "../../user/entities/user.entity"
import {YesNo} from '../../common/enum/yn.enum';

export default class CreateInitialData implements Seeder {
    public async run(dataSource: DataSource): Promise<any> {
        await dataSource
            .createQueryBuilder()
            .insert()
            .into(Component)
            .values([
                {
                    "createdAt": "2022-09-28 19:55:38",
                    "updatedAt": "2022-11-04 11:08:50.607012",
                    "id": 1,
                    "type": "CHART_LINE",
                    "title": "선형 차트",
                    "description": "Line Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}",
                    "icon": "icon/ct-line.svg",
                    "seq": 3,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.111257",
                    "updatedAt": "2022-11-04 11:08:49.711362",
                    "id": 2,
                    "type": "CHART_AREA",
                    "title": "영역형 차트",
                    "description": "Area Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}",
                    "icon": "icon/ct-area.svg",
                    "seq": 4,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.129862",
                    "updatedAt": "2022-11-04 11:08:50.132245",
                    "id": 3,
                    "type": "CHART_BAR",
                    "title": "세로 막대형 차트",
                    "description": "Bar Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}",
                    "icon": "icon/ct-bar.svg",
                    "seq": 5,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.147718",
                    "updatedAt": "2022-11-04 11:08:49.982346",
                    "id": 4,
                    "type": "CHART_COLUMN",
                    "title": "가로 막대형 차트",
                    "description": "Column Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true}",
                    "icon": "icon/ct-column.svg",
                    "seq": 6,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.165671",
                    "updatedAt": "2022-11-04 11:08:50.534356",
                    "id": 5,
                    "type": "MIXED_CHART_LINE_BAR",
                    "title": "선형과 세로 막대형 복합 차트",
                    "description": "Mixed Line and Bar Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\",\"type\":\"line\"},{\"color\":\"#47a8ea\",\"aggregation\":\"sum\",\"type\":\"bar\"}],\"label\":true}",
                    "icon": "icon/ct-mixed-line-bar.svg",
                    "seq": 7,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.183978",
                    "updatedAt": "2022-11-04 11:08:50.479527",
                    "id": 6,
                    "type": "CHART_PIE",
                    "title": "원형 차트",
                    "description": "Pie Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\"}}",
                    "icon": "icon/ct-pie.svg",
                    "seq": 13,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.201009",
                    "updatedAt": "2022-11-04 11:08:50.775726",
                    "id": 7,
                    "type": "CHART_NIGHTINGALE",
                    "title": "나이팅게일 차트",
                    "description": "Nightingale Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"20%\",\"75%\"]}}",
                    "icon": "icon/ct-nightingale.svg",
                    "seq": 15,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.218438",
                    "updatedAt": "2022-11-10 13:20:14.402150",
                    "id": 8,
                    "type": "CHART_BUBBLE",
                    "title": "거품형 차트",
                    "description": "Bubble Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"title\":\"이름 1\",\"color\":\"#6aa7eb\"}]}",
                    "icon": "icon/ct-bubble.svg",
                    "seq": 18,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.235656",
                    "updatedAt": "2022-11-04 19:00:32.350241",
                    "id": 9,
                    "type": "CHART_RADAR",
                    "title": "방사형 차트",
                    "description": "Radar Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"color\":\"#2870c5\",\"aggregation\":\"sum\"}],\"label\":true}",
                    "icon": "icon/ct-radar.svg",
                    "seq": 16,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 15:16:18.253510",
                    "updatedAt": "2022-11-10 13:20:14.433608",
                    "id": 10,
                    "type": "CHART_SCATTER",
                    "title": "분산형 차트",
                    "description": "Scatter Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"title\":\"이름 1\",\"symbolSize\":\"20\",\"color\":\"#6aa7eb\"}]}",
                    "icon": "icon/ct-scatter.svg",
                    "seq": 17,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-28 19:48:20",
                    "updatedAt": "2022-11-04 11:08:50.231885",
                    "id": 11,
                    "type": "CHART_DONUT",
                    "title": "도넛형 차트",
                    "description": "Donut Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"30%\",\"75%\"]}}",
                    "icon": "icon/ct-donut.svg",
                    "seq": 14,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 10:51:13.436536",
                    "updatedAt": "2022-11-04 11:17:47.101383",
                    "id": 12,
                    "type": "BOARD_NUMERIC",
                    "title": "숫자판",
                    "description": "Score Board",
                    "category": "SCORE",
                    "option": "{\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score.svg",
                    "seq": 1,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 10:51:34.693945",
                    "updatedAt": "2022-11-04 11:17:47.127512",
                    "id": 13,
                    "type": "BOARD_TABLE",
                    "title": "표",
                    "description": "Data Grid",
                    "category": "TABLE",
                    "option": "{\"columns\":[]}",
                    "icon": "icon/ct-grid.svg",
                    "seq": 2,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 10:51:34.783042",
                    "updatedAt": "2022-11-04 18:47:23.099317",
                    "id": 14,
                    "type": "CHART_STACKED_LINE",
                    "title": "누적 선형 차트",
                    "description": "Stacked Line Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}",
                    "icon": "icon/ct-stacked-line.svg",
                    "seq": 8,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 10:51:35.033840",
                    "updatedAt": "2022-11-04 18:47:23.078565",
                    "id": 15,
                    "type": "CHART_STACKED_AREA",
                    "title": "누적 영역형 차트",
                    "description": "Stacked Area Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}",
                    "icon": "icon/ct-stacked-area.svg",
                    "seq": 9,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 10:58:46.125790",
                    "updatedAt": "2022-11-04 18:47:23.053801",
                    "id": 16,
                    "type": "CHART_STACKED_COLUMN",
                    "title": "누적 가로 막대형 차트",
                    "description": "Stacked Column Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}",
                    "icon": "icon/ct-stacked-column.svg",
                    "seq": 10,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-29 11:02:11.889462",
                    "updatedAt": "2022-11-04 18:47:23.021322",
                    "id": 17,
                    "type": "CHART_STACKED_BAR",
                    "title": "누적 세로 막대형 차트",
                    "description": "Stacked Bar Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true}",
                    "icon": "icon/ct-stacked-bar.svg",
                    "seq": 11,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-30 14:26:41.497188",
                    "updatedAt": "2022-11-04 11:08:50.710132",
                    "id": 19,
                    "type": "CHART_TREEMAP",
                    "title": "트리맵 차트",
                    "description": "Treemap Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"},\"label\":true}",
                    "icon": "icon/ct-treemap.svg",
                    "seq": 19,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-30 14:27:25.459299",
                    "updatedAt": "2022-11-04 11:08:50.732909",
                    "id": 20,
                    "type": "CHART_CANDLESTICK",
                    "title": "캔들스틱 차트",
                    "description": "Candlestick Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#FA5A5A\",\"aggregation\":\"sum\"},{\"color\":\"#2870C4\",\"aggregation\":\"sum\"},{\"color\":\"#E03B3B\",\"aggregation\":\"sum\"},{\"color\":\"#215DA3\",\"aggregation\":\"sum\"}]}",
                    "icon": "icon/ct-candlestick.svg",
                    "seq": 22,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-09-30 14:30:15.042412",
                    "updatedAt": "2022-11-04 11:08:49.598809",
                    "id": 21,
                    "type": "CHART_GAUGE",
                    "title": "계기판 차트",
                    "description": "Gauge Chart",
                    "category": "SQUARE",
                    "option": "{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}",
                    "icon": "icon/ct-gauge.svg",
                    "seq": 23,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-04 16:53:01.371721",
                    "updatedAt": "2022-11-04 11:08:49.805040",
                    "id": 22,
                    "type": "CHART_SUNBURST",
                    "title": "선버스트 차트",
                    "description": "Sunburst Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"},\"label\":true}",
                    "icon": "icon/ct-sunburst.svg",
                    "seq": 20,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-05 14:45:50.362534",
                    "updatedAt": "2022-11-04 11:08:50.336550",
                    "id": 23,
                    "type": "CHART_HEATMAP",
                    "title": "히트맵 차트",
                    "description": "Heatmap Chart",
                    "category": "SQUARE",
                    "option": "{\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"],\"aggregation\":\"sum\"}",
                    "icon": "icon/ct-heatmap.svg",
                    "seq": 21,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-05 15:06:18.415655",
                    "updatedAt": "2022-11-04 11:08:50.582746",
                    "id": 24,
                    "type": "CHART_FUNNEL",
                    "title": "깔때기형 차트",
                    "description": "Funnel Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\"}}",
                    "icon": "icon/ct-funnel.svg",
                    "seq": 24,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-07 18:02:26.568254",
                    "updatedAt": "2022-11-04 11:08:50.058784",
                    "id": 25,
                    "type": "CHART_3D_BAR",
                    "title": "3D 막대형 차트",
                    "description": "3D Bar Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#2870c4\",\"#4ecef6\",\"#ffd43b\",\"#fa5a5a\"]}",
                    "icon": "icon/ct-3d-bar.svg",
                    "seq": 28,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-12 16:45:23.767491",
                    "updatedAt": "2022-11-04 11:08:50.313869",
                    "id": 26,
                    "type": "CHART_3D_LINE",
                    "title": "3D 선형 차트",
                    "description": "3D Line Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}]}",
                    "icon": "icon/ct-3d-line.svg",
                    "seq": 27,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-13 11:23:31.980147",
                    "updatedAt": "2022-11-10 13:12:21.063112",
                    "id": 27,
                    "type": "CHART_3D_SCATTER",
                    "title": "3D 분산형 차트",
                    "description": "3D Scatter Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"title\":\"이름 1\",\"symbolSize\":\"20\",\"color\":\"#6aa7eb\"}]}",
                    "icon": "icon/ct-3d-scatter.svg",
                    "seq": 29,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-13 21:23:06.474435",
                    "updatedAt": "2022-11-10 13:20:14.376403",
                    "id": 28,
                    "type": "CHART_3D_BUBBLE",
                    "title": "3D 거품형 차트",
                    "description": "3D Bubble Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"title\":\"이름 1\",\"color\":\"#6aa7eb\"}]}",
                    "icon": "icon/ct-3d-bubble.svg",
                    "seq": 30,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-14 14:50:41.667043",
                    "updatedAt": "2022-10-30 19:39:25.164231",
                    "id": 29,
                    "type": "CHART_WATERFALL_BAR",
                    "title": "폭포수 세로 차트",
                    "description": "Waterfall Bar Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#6aa7eb\",\"#fa5a5a\"],\"mark\":true}",
                    "icon": "",
                    "seq": null,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-14 14:53:02.853952",
                    "updatedAt": "2022-10-30 19:39:25.132789",
                    "id": 30,
                    "type": "CHART_WATERFALL_COLUMN",
                    "title": "폭포수 가로 차트",
                    "description": "Waterfall Column Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"aggregation\":\"sum\"}],\"color\":[\"#6aa7eb\",\"#fa5a5a\"],\"mark\":true}",
                    "icon": "",
                    "seq": null,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-14 15:21:20.186899",
                    "updatedAt": "2022-11-04 11:08:50.082534",
                    "id": 31,
                    "type": "CHART_POLAR_BAR",
                    "title": "극좌표 막대형 차트",
                    "description": "Polar Bar Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"radius\":[\"10%\",\"75%\"]}",
                    "icon": "icon/ct-polar-bar.svg",
                    "seq": 25,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-14 16:07:18.347330",
                    "updatedAt": "2022-11-04 11:08:50.183963",
                    "id": 32,
                    "type": "MIXED_CHART_LINE_PIE",
                    "title": "선형과 원형 복합 차트",
                    "description": "Mixed Line and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}",
                    "icon": "icon/ct-pie-line.svg",
                    "seq": 31,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-15 20:09:47.754250",
                    "updatedAt": "2022-11-04 11:08:50.456889",
                    "id": 33,
                    "type": "CHART_POLAR_STACKED_BAR",
                    "title": "극좌표 누적 막대형 차트",
                    "description": "Polar Stacked Bar Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"radius\":[\"10%\",\"75%\"]}",
                    "icon": "icon/ct-polar-stacked-bar.svg",
                    "seq": 26,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 16:22:43.859648",
                    "updatedAt": "2022-11-04 11:08:50.383235",
                    "id": 34,
                    "type": "MIXED_CHART_AREA_PIE",
                    "title": "영역형과 원형 복합 차트",
                    "description": "Mixed Area and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}",
                    "icon": "icon/ct-pie-area.svg",
                    "seq": 32,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 16:23:33.681125",
                    "updatedAt": "2022-11-04 11:08:50.407190",
                    "id": 35,
                    "type": "MIXED_CHART_BAR_PIE",
                    "title": "세로 막대형과 원형 복합 차트",
                    "description": "Mixed Bar and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}",
                    "icon": "icon/ct-pie-bar.svg",
                    "seq": 33,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 16:24:04.783798",
                    "updatedAt": "2022-11-04 11:08:50.756074",
                    "id": 36,
                    "type": "MIXED_CHART_COLUMN_PIE",
                    "title": "가로 막대형과 원형 복합 차트",
                    "description": "Mixed Column and Pie Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"mark\":true}",
                    "icon": "icon/ct-pie-column.svg",
                    "seq": 34,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 16:34:32.081057",
                    "updatedAt": "2022-11-04 11:08:49.933337",
                    "id": 37,
                    "type": "MIXED_CHART_STACKED_BAR_PIE",
                    "title": "누적 세로 막대형과 원형 복합 차트",
                    "description": "Mixed Stacked-Bar and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}",
                    "icon": "icon/ct-pie-stacked-bar.svg",
                    "seq": 35,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 16:35:01.816820",
                    "updatedAt": "2022-11-04 11:08:49.735548",
                    "id": 38,
                    "type": "MIXED_CHART_STACKED_COLUMN_PIE",
                    "title": "누적 가로 막대형과 원형 복합 차트",
                    "description": "Mixed Stacked-Column and Pie Chart",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}",
                    "icon": "icon/ct-pie-stacked-column.svg",
                    "seq": 36,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 17:00:01.525246",
                    "updatedAt": "2022-11-04 11:08:50.153933",
                    "id": 39,
                    "type": "MIXED_CHART_STACKED_LINE_PIE",
                    "title": "누적 선형과 원형 복합 차트",
                    "description": "Mixed Stacked-Line and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}",
                    "icon": "icon/ct-pie-stacked-line.svg",
                    "seq": 37,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 17:00:18.251377",
                    "updatedAt": "2022-11-04 11:08:50.006063",
                    "id": 40,
                    "type": "MIXED_CHART_STACKED_AREA_PIE",
                    "title": "누적 영역형과 원형 복합 차트",
                    "description": "Mixed Stacked-Area and Pie Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"pie\":{\"color\":[],\"center\":[\"80%\",\"20%\"],\"radius\":\"20%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"label\":true}",
                    "icon": "icon/ct-pie-stacked-area.svg",
                    "seq": 38,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-17 17:36:30.244205",
                    "updatedAt": "2022-11-04 11:08:50.558645",
                    "id": 41,
                    "type": "MIXED_CHART_DONUT_PIE",
                    "title": "도넛형과 원형 복합 차트",
                    "description": "Mixed Donut and Pie Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"aggregation\":\"sum\",\"radius\":[\"45%\",\"60%\"],\"label\":\"{b}\"},\"pie\":{\"radius\":\"30%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"color\":[]}",
                    "icon": "icon/ct-pie-donut.svg",
                    "seq": 39,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 18:20:30.428782",
                    "updatedAt": "2022-11-04 11:08:50.256753",
                    "id": 42,
                    "type": "MIXED_CHART_NIGHTINGALE_PIE",
                    "title": "나이팅게일과 원형 복합 차트",
                    "description": "Mixed Nightingale and Pie Chart",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"aggregation\":\"sum\",\"radius\":[\"45%\",\"60%\"],\"label\":\"{b}\"},\"pie\":{\"radius\":\"30%\",\"aggregation\":\"sum\",\"label\":\"{b}\"},\"color\":[]}",
                    "icon": "icon/ct-pie-nightingale.svg",
                    "seq": 40,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 09:53:24.023311",
                    "updatedAt": "2022-11-04 11:08:50.944108",
                    "id": 43,
                    "type": "MIXED_CHART_LINE_STACKED_BAR",
                    "title": "선형과 누적 세로 막대형 복합 차트",
                    "description": "Mixed Line and Stacked-Bar Chart",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\",\"type\":\"line\"},{\"color\":\"#47a8ea\",\"aggregation\":\"sum\",\"type\":\"bar\"}],\"label\":true}",
                    "icon": "icon/ct-mixed-line-stacked-bar.svg",
                    "seq": 12,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 15:26:58.627116",
                    "updatedAt": "2022-11-04 11:08:49.956963",
                    "id": 44,
                    "type": "MIXED_CHART_LINE_BOARD_NUMERIC",
                    "title": "선형 차트와 숫자 보드",
                    "description": "Line Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-line.svg",
                    "seq": 41,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:27.549154",
                    "updatedAt": "2022-11-04 11:08:49.685616",
                    "id": 45,
                    "type": "MIXED_CHART_AREA_BOARD_NUMERIC",
                    "title": "영역형 차트와 숫자 보드",
                    "description": "Area Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-area.svg",
                    "seq": 42,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:33.904190",
                    "updatedAt": "2022-11-04 11:08:50.206872",
                    "id": 46,
                    "type": "MIXED_CHART_BAR_BOARD_NUMERIC",
                    "title": "세로 막대형 차트와 숫자 보드",
                    "description": "Bar Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-bar.svg",
                    "seq": 43,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:40.386273",
                    "updatedAt": "2022-11-04 11:08:50.359830",
                    "id": 47,
                    "type": "MIXED_CHART_COLUMN_BOARD_NUMERIC",
                    "title": "가로 막대형 차트와 숫자 보드",
                    "description": "Column Chart and Score Board",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"mark\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-column.svg",
                    "seq": 44,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:46.271170",
                    "updatedAt": "2022-11-04 11:08:50.033882",
                    "id": 48,
                    "type": "MIXED_CHART_STACKED_LINE_BOARD_NUMERIC",
                    "title": "누적 선형 차트와 숫자 보드",
                    "description": "Stacked Line Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-stacked-line.svg",
                    "seq": 45,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:51.695465",
                    "updatedAt": "2022-11-04 11:08:50.282899",
                    "id": 49,
                    "type": "MIXED_CHART_STACKED_AREA_BOARD_NUMERIC",
                    "title": "누적 영역형 차트와 숫자 보드",
                    "description": "Stacked Area Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-stacked-area.svg",
                    "seq": 46,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:37:57.135223",
                    "updatedAt": "2022-11-04 11:08:50.687986",
                    "id": 50,
                    "type": "MIXED_CHART_STACKED_BAR_BOARD_NUMERIC",
                    "title": "누적 세로 막대형 차트와 숫자 보드",
                    "description": "Stacked Bar Chart and Score Board",
                    "category": "HORIZONTAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-stacked-bar.svg",
                    "seq": 47,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:38:03.095468",
                    "updatedAt": "2022-11-04 11:08:50.503672",
                    "id": 51,
                    "type": "MIXED_CHART_STACKED_COLUMN_BOARD_NUMERIC",
                    "title": "누적 가로 막대형 차트와 숫자 보드",
                    "description": "Stacked Column Chart and Score Board",
                    "category": "VERTICAL",
                    "option": "{\"series\":[{\"color\":\"#6aa7eb\",\"aggregation\":\"sum\"}],\"label\":true,\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-stacked-column.svg",
                    "seq": 48,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-19 20:38:49.744062",
                    "updatedAt": "2022-11-04 11:08:49.761182",
                    "id": 52,
                    "type": "MIXED_CHART_DONUT_BOARD_NUMERIC",
                    "title": "도넛형 차트와 숫자 보드",
                    "description": "Donut Chart and Score Board",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"40%\",\"75%\"]},\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-donut.svg",
                    "seq": 49,
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-20 20:03:57.496413",
                    "updatedAt": "2022-11-04 11:08:50.841390",
                    "id": 53,
                    "type": "MIXED_CHART_NIGHTINGALE_BOARD_NUMERIC",
                    "title": "나이팅게일 차트와 숫자 보드",
                    "description": "Nightingale Chart and Score Board",
                    "category": "SQUARE",
                    "option": "{\"series\":{\"color\":[],\"aggregation\":\"sum\",\"label\":\"{b}\",\"radius\":[\"40%\",\"75%\"]},\"header\":{\"title\":\"타이틀을 입력하세요\",\"fontSize\":20,\"color\":\"#4A4A4A\"},\"content\":{\"aggregation\":\"sum\",\"fontSize\":50,\"color\":\"#4A4A4A\"}}",
                    "icon": "icon/ct-score-nightingale.svg",
                    "seq": 50,
                    "useYn": YesNo.YES
                }
            ])
            .execute()

        await dataSource
            .createQueryBuilder()
            .insert()
            .into(DatabaseType)
            .values([
                {
                    "id": 1,
                    "engine": "mysql2",
                    "type": "mysql",
                    "title": "MySQL",
                    "seq": 1,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:44:18.946447",
                    "updatedAt": "2022-11-02 14:38:54.469203"
                },
                {
                    "id": 2,
                    "engine": "mysql2",
                    "type": "maria",
                    "title": "MariaDB",
                    "seq": 2,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:46:14.700394",
                    "updatedAt": "2022-11-01 10:44:29.401041"
                },
                {
                    "id": 3,
                    "engine": "pg",
                    "type": "postgres",
                    "title": "PostgreSQL",
                    "seq": 3,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:21.842039",
                    "updatedAt": "2022-11-02 14:38:54.494626"
                },
                {
                    "id": 4,
                    "engine": "oracledb",
                    "type": "oracle",
                    "title": "Oracle",
                    "seq": 4,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:22.361833",
                    "updatedAt": "2022-11-02 14:38:54.538484"
                },
                {
                    "id": 5,
                    "engine": "db2",
                    "type": "db2",
                    "title": "DB2",
                    "seq": 5,
                    "useYn": YesNo.NO,
                    "createdAt": "2022-10-18 17:49:22.982368",
                    "updatedAt": "2022-11-08 10:08:32.782722"
                },
                {
                    "id": 6,
                    "engine": "pg",
                    "type": "redshift",
                    "title": "Amazon Redshift",
                    "seq": 6,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:23.378836",
                    "updatedAt": "2022-11-02 11:29:44.018425"
                },
                {
                    "id": 7,
                    "engine": "bigquery",
                    "type": "bigquery",
                    "title": "Google Cloud BigQuery",
                    "seq": 7,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:23.784827",
                    "updatedAt": "2022-11-01 10:44:29.272662"
                },
                {
                    "id": 8,
                    "engine": "sqlite3",
                    "type": "sqlite",
                    "title": "SQLite",
                    "seq": 8,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:23.966790",
                    "updatedAt": "2022-11-02 14:38:54.517675"
                },
                {
                    "id": 9,
                    "engine": "mssql",
                    "type": "mssql",
                    "title": "MSSQL",
                    "seq": 9,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:24.300902",
                    "updatedAt": "2022-11-01 10:44:29.355552"
                },
                {
                    "id": 10,
                    "engine": "snowflake",
                    "type": "snowflake",
                    "title": "Snowflake",
                    "seq": 10,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-10-18 17:49:24.684788",
                    "updatedAt": "2022-11-07 23:38:07.292660"
                },
                {
                    "id": 11,
                    "engine": "mysql2",
                    "type": "aurora",
                    "title": "Amazon Aurora",
                    "seq": 11,
                    "useYn": YesNo.NO,
                    "createdAt": "2022-10-20 14:59:13.794764",
                    "updatedAt": "2022-11-01 10:44:29.252301"
                },
                {
                    "id": 12,
                    "engine": "cockroachdb",
                    "type": "cockroachDB",
                    "title": "CockroachDB",
                    "seq": 12,
                    "useYn": YesNo.YES,
                    "createdAt": "2022-11-07 11:18:14.301920",
                    "updatedAt": "2022-11-07 11:36:16.633650"
                },
                {
                    "id": 13,
                    "engine": "pg",
                    "type": "postGIS",
                    "title": "postGIS",
                    "seq": 13,
                    "useYn": YesNo.NO,
                    "createdAt": "2022-11-07 11:36:16.689282",
                    "updatedAt": "2022-11-08 10:08:32.831030"
                }
            ])
            .execute();

        await dataSource
            .createQueryBuilder()
            .insert()
            .into(Template)
            .values([
                {
                    "createdAt": "2022-10-18 20:09:15.813098",
                    "updatedAt": "2022-11-07 11:22:28.811018",
                    "id": 7,
                    "title": "세로 2단 구성",
                    "description": "차트를 양쪽으로 균등하게 배열하여 비교 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:09:30.272987",
                    "updatedAt": "2022-11-07 11:22:28.858191",
                    "id": 8,
                    "title": "상하단 구성",
                    "description": "상하 구조로 데이터의 연속성으로 비교 분석 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:11:09.201449",
                    "updatedAt": "2022-11-07 11:22:28.964026",
                    "id": 9,
                    "title": "2단 구성과 하단 상세 데이터",
                    "description": "주요 차트를 상단에 2가지 배열하여 비교 후 하단에 상세데이터 확인 필요 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:13:46.491995",
                    "updatedAt": "2022-11-07 11:22:28.925207",
                    "id": 10,
                    "title": "차트의 크기 활용한 2단 구성",
                    "description": "좌측에 상세 차트를 확인 후 우측에 요약 차트를 확인할 경우 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:15:00.617359",
                    "updatedAt": "2022-11-07 11:22:28.895292",
                    "id": 11,
                    "title": "3단 구성과 상세 데이터",
                    "description": "3가지의 차트로 데이터를 확인 후 하단 영역에 상세 데이터를 배열 할 경우 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:16:12.183883",
                    "updatedAt": "2022-11-07 11:22:29.023153",
                    "id": 12,
                    "title": "3단 구성과 하단 2단 구성 복합 레이아웃",
                    "description": "상단 3가지 차트 나열 후 하단 비교를 원하는 차트를 양쪽 배열 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:22:09.156107",
                    "updatedAt": "2022-11-07 11:22:28.717357",
                    "id": 13,
                    "title": "중앙 주요 차트와 좌우 상세 차트",
                    "description": "주요 차트를 중앙에 노출하여 집중도를 높이고 좌우로 상세 차트를 배열 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:23:51.350276",
                    "updatedAt": "2022-11-07 11:22:28.607605",
                    "id": 14,
                    "title": "4단 상단 구성과 하단 2가지 차트",
                    "description": "비교 가능한 4가지의 차트 배열 후 하단 영역을 크게 활용하여 차트 배열 시 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:25:07.541090",
                    "updatedAt": "2022-11-07 11:22:28.677493",
                    "id": 15,
                    "title": "4단 상단 구성과 하단 3가지 차트",
                    "description": "4가지의 차트 배열 후 하단 3가지 차트 배열로 상세 차트를 같이 노출 원할 때 사용",
                    "useYn": YesNo.YES
                },
                {
                    "createdAt": "2022-10-18 20:27:11.341515",
                    "updatedAt": "2022-11-07 11:22:28.770548",
                    "id": 16,
                    "title": "4단구성 상하단",
                    "description": "한 화면 다양한 차트를 균일한 크기로 노출할 때 사용",
                    "useYn": YesNo.YES
                }
            ])
            .execute();

        await dataSource
            .createQueryBuilder()
            .insert()
            .into(TemplateItem)
            .values([
                {
                    "createdAt": "2022-10-18 20:09:30.535188",
                    "updatedAt": "2022-10-31 13:53:57.480929",
                    "id": 17,
                    "templateId": 8,
                    "x": 0,
                    "y": 0,
                    "width": 12,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:09:30.577167",
                    "updatedAt": "2022-10-31 13:53:57.550808",
                    "id": 18,
                    "templateId": 8,
                    "x": 0,
                    "y": 4,
                    "width": 12,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:11:09.409213",
                    "updatedAt": "2022-10-31 13:53:57.503750",
                    "id": 19,
                    "templateId": 9,
                    "x": 0,
                    "y": 0,
                    "width": 6,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:11:09.492022",
                    "updatedAt": "2022-10-31 13:53:57.595719",
                    "id": 20,
                    "templateId": 9,
                    "x": 6,
                    "y": 0,
                    "width": 6,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:11:09.620547",
                    "updatedAt": "2022-10-31 13:53:57.529196",
                    "id": 21,
                    "templateId": 9,
                    "x": 0,
                    "y": 4,
                    "width": 12,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:13:46.879282",
                    "updatedAt": "2022-10-20 11:35:29.476446",
                    "id": 22,
                    "templateId": 10,
                    "x": 0,
                    "y": 0,
                    "width": 8,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:13:46.979450",
                    "updatedAt": "2022-10-20 11:35:29.428496",
                    "id": 23,
                    "templateId": 10,
                    "x": 8,
                    "y": 0,
                    "width": 4,
                    "height": 4,
                    "recommendCategory": "SQUARE",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:13:47.030472",
                    "updatedAt": "2022-10-31 14:01:27.290678",
                    "id": 24,
                    "templateId": 10,
                    "x": 0,
                    "y": 4,
                    "width": 8,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:13:47.150264",
                    "updatedAt": "2022-10-31 14:01:27.312277",
                    "id": 25,
                    "templateId": 10,
                    "x": 8,
                    "y": 4,
                    "width": 4,
                    "height": 4,
                    "recommendCategory": "SQUARE",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:15:00.827668",
                    "updatedAt": "2022-10-20 14:30:10.140183",
                    "id": 26,
                    "templateId": 11,
                    "x": 0,
                    "y": 0,
                    "width": 4,
                    "height": 4,
                    "recommendCategory": "SQUARE",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:15:00.983319",
                    "updatedAt": "2022-10-20 14:30:09.633428",
                    "id": 27,
                    "templateId": 11,
                    "x": 4,
                    "y": 0,
                    "width": 4,
                    "height": 4,
                    "recommendCategory": "SQUARE",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:15:01.021435",
                    "updatedAt": "2022-10-20 14:30:10.018483",
                    "id": 28,
                    "templateId": 11,
                    "x": 8,
                    "y": 0,
                    "width": 4,
                    "height": 4,
                    "recommendCategory": "SQUARE",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:15:01.129825",
                    "updatedAt": "2022-10-31 14:02:32.359585",
                    "id": 29,
                    "templateId": 11,
                    "x": 0,
                    "y": 4,
                    "width": 12,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:16:12.397432",
                    "updatedAt": "2022-10-31 14:04:23.857225",
                    "id": 30,
                    "templateId": 12,
                    "x": 0,
                    "y": 0,
                    "width": 4,
                    "height": 3,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:16:12.496713",
                    "updatedAt": "2022-10-31 14:04:23.877860",
                    "id": 31,
                    "templateId": 12,
                    "x": 4,
                    "y": 0,
                    "width": 4,
                    "height": 3,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:16:12.694952",
                    "updatedAt": "2022-10-31 14:04:23.813548",
                    "id": 32,
                    "templateId": 12,
                    "x": 8,
                    "y": 0,
                    "width": 4,
                    "height": 3,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:16:12.806928",
                    "updatedAt": "2022-10-31 14:04:23.898490",
                    "id": 33,
                    "templateId": 12,
                    "x": 0,
                    "y": 3,
                    "width": 6,
                    "height": 5,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:16:12.923163",
                    "updatedAt": "2022-10-31 14:04:23.837218",
                    "id": 34,
                    "templateId": 12,
                    "x": 6,
                    "y": 3,
                    "width": 6,
                    "height": 5,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:22:09.467795",
                    "updatedAt": "2022-10-31 14:06:20.147607",
                    "id": 35,
                    "templateId": 13,
                    "x": 0,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:22:09.573071",
                    "updatedAt": "2022-10-31 14:06:20.127660",
                    "id": 36,
                    "templateId": 13,
                    "x": 3,
                    "y": 0,
                    "width": 6,
                    "height": 8,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:22:09.672497",
                    "updatedAt": "2022-10-31 14:06:20.168307",
                    "id": 37,
                    "templateId": 13,
                    "x": 9,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:22:09.770825",
                    "updatedAt": "2022-10-31 14:06:20.193273",
                    "id": 38,
                    "templateId": 13,
                    "x": 0,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:22:09.787363",
                    "updatedAt": "2022-10-31 14:06:20.215941",
                    "id": 39,
                    "templateId": 13,
                    "x": 9,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.461373",
                    "updatedAt": "2022-10-31 14:07:31.009313",
                    "id": 40,
                    "templateId": 14,
                    "x": 0,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.564823",
                    "updatedAt": "2022-10-31 14:07:31.029860",
                    "id": 41,
                    "templateId": 14,
                    "x": 3,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.646518",
                    "updatedAt": "2022-10-31 14:07:30.919372",
                    "id": 42,
                    "templateId": 14,
                    "x": 6,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.706616",
                    "updatedAt": "2022-10-31 14:07:30.942272",
                    "id": 43,
                    "templateId": 14,
                    "x": 9,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.777790",
                    "updatedAt": "2022-10-31 14:07:30.988065",
                    "id": 44,
                    "templateId": 14,
                    "x": 0,
                    "y": 4,
                    "width": 6,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:23:51.868905",
                    "updatedAt": "2022-10-31 14:07:30.964043",
                    "id": 45,
                    "templateId": 14,
                    "x": 6,
                    "y": 4,
                    "width": 6,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:07.639935",
                    "updatedAt": "2022-10-31 14:09:21.612894",
                    "id": 46,
                    "templateId": 15,
                    "x": 0,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:07.658536",
                    "updatedAt": "2022-10-31 14:09:21.633533",
                    "id": 47,
                    "templateId": 15,
                    "x": 3,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:07.761440",
                    "updatedAt": "2022-10-31 14:09:21.419835",
                    "id": 48,
                    "templateId": 15,
                    "x": 6,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:07.832614",
                    "updatedAt": "2022-10-31 14:09:21.442226",
                    "id": 49,
                    "templateId": 15,
                    "x": 9,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:07.898582",
                    "updatedAt": "2022-10-31 14:09:20.587806",
                    "id": 50,
                    "templateId": 15,
                    "x": 0,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:08.002465",
                    "updatedAt": "2022-10-31 14:09:21.464091",
                    "id": 51,
                    "templateId": 15,
                    "x": 3,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:25:08.028974",
                    "updatedAt": "2022-10-31 14:09:20.939658",
                    "id": 52,
                    "templateId": 15,
                    "x": 6,
                    "y": 4,
                    "width": 6,
                    "height": 4,
                    "recommendCategory": "HORIZONTAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.653368",
                    "updatedAt": "2022-10-31 14:09:21.096166",
                    "id": 53,
                    "templateId": 16,
                    "x": 0,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.671567",
                    "updatedAt": "2022-10-31 14:09:21.248356",
                    "id": 54,
                    "templateId": 16,
                    "x": 3,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.757436",
                    "updatedAt": "2022-10-31 14:09:21.268875",
                    "id": 55,
                    "templateId": 16,
                    "x": 6,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.776540",
                    "updatedAt": "2022-10-31 14:09:21.787058",
                    "id": 56,
                    "templateId": 16,
                    "x": 9,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.793894",
                    "updatedAt": "2022-10-31 14:09:20.733485",
                    "id": 57,
                    "templateId": 16,
                    "x": 0,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.835491",
                    "updatedAt": "2022-10-31 14:09:20.753253",
                    "id": 58,
                    "templateId": 16,
                    "x": 3,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.866593",
                    "updatedAt": "2022-10-31 14:09:20.919894",
                    "id": 59,
                    "templateId": 16,
                    "x": 6,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:27:11.883385",
                    "updatedAt": "2022-10-31 14:09:20.558693",
                    "id": 60,
                    "templateId": 16,
                    "x": 9,
                    "y": 4,
                    "width": 3,
                    "height": 4,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:36:41.226416",
                    "updatedAt": "2022-10-31 13:53:57.573866",
                    "id": 63,
                    "templateId": 7,
                    "x": 0,
                    "y": 0,
                    "width": 6,
                    "height": 8,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                },
                {
                    "createdAt": "2022-10-18 20:36:41.371585",
                    "updatedAt": "2022-10-31 13:53:57.455332",
                    "id": 64,
                    "templateId": 7,
                    "x": 6,
                    "y": 0,
                    "width": 6,
                    "height": 8,
                    "recommendCategory": "VERTICAL",
                    "recommendType": ""
                }
            ])
            .execute();

        await dataSource
            .createQueryBuilder()
            .insert()
            .into(User)
            .values([
                {
                    "id": 1,
                    "email": "guest@gmail.com",
                    "password": "0258acb251701900c2abcde987033e032838df1eb39f10bfb9e9f6398866b13acb104f00485b92b11db90544744280626980c3888b9ba98ea8f319f9747d051e",
                    "userId": "guest"
                }
            ])
            .execute();
    }
}