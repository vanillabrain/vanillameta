# Docker Compose 가이드

체험용 한 줄 실행은 [README_DOCKER.md](../README_DOCKER.md)가 기준이다. 이 문서는 어느 compose 파일을 언제 쓰는지만 구분한다.

| 목적                     | 파일                                                                  | 실행                                                         |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| 체험·동작 확인           | [`docker-compose.yml`](../docker-compose.yml)                         | `docker compose up --build`                                  |
| 운영(Caddy TLS, 단일 VM) | [`deploy/docker-compose.prod.yml`](../deploy/docker-compose.prod.yml) | [`deploy/README.md`](../deploy/README.md)의 런북             |
| 소스 수정·핫 리로드      | compose 없이 직접 실행                                                | [README의 Local development](../README.md#local-development) |

## 체험 스택의 동작

- 이미지는 운영과 같은 `backend-api/Dockerfile.prod`, `frontend-web/Dockerfile.prod`를 쓴다. 그래서 체험에서 확인한 빌드와 프록시 경로가 운영 이미지와 같다.
- Dockerfile은 같고(`Dockerfile.prod`), 런타임에서 가장 큰 차이는 `NODE_ENV=dev`다. 부팅 때 스키마 동기화와 `guest` 데모 계정 시드(`run-seed`)를 하기 때문이다. 운영(`prod`)은 `guest` 행이 있으면 부팅을 거부하고, 스키마는 `migrate-prod`가 만든다. 그 밖에 운영 compose는 Caddy(TLS)와 외부 egress 네트워크를 두고 ghcr 이미지를 쓰지만, 체험 스택은 로컬에서 빌드하고 healthcheck 간격도 짧게 덮어쓴다.
- 웹이 `/v1`을 같은 오리진에서 backend로 프록시한다. 브라우저는 3000 포트만 쓰고, backend와 PostgreSQL은 호스트에 열지 않는다.

## 이전 구성에서 바뀐 것 (2026-11-04)

- `docker-compose.override.yml`을 삭제했다. `docker compose up`이 자동으로 병합해 존재하지 않는 `nginx` 서비스를 선언하던 개발용 파일이다.
- `docker-compose-helper.sh`를 삭제했다. 삭제된 override와 옛 80포트·SQLite 구성을 전제로 했다.
- `backend-api/docker-compose.yml`(`NODE_ENV=production`)은 `production-guard`가 거부하는 옛 구성이라 사용하지 않는다.
- 과거 계획서(`docs/tasks/`, `.moonklabs/`)의 옛 명령은 역사 기록이며 따라 하지 않는다.

검증 범위와 남은 공백은 [docker-quickstart 검증](testing/docker-quickstart.md)을 본다.
