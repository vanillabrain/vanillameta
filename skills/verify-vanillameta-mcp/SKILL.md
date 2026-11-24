---
name: verify-vanillameta-mcp
description: Drive the VanillaMeta Docker Compose stack with Postgres to prove that an AI host can connect over MCP, create html, document, sheet and chart artifacts, and that a person can open them in the browser. Use for changes to the MCP OAuth flow, the ai_artifact table or migration, the artifact viewer, or the compose quickstart. Use verify-vanillameta for the SQLite dev servers.
---

# verify-vanillameta-mcp

Surface: the Compose stack (frontend, backend, Postgres) built from this checkout, the MCP endpoint `POST $VM_API_URL/mcp`, and the viewer at `$VM_WEB_URL/ai-artifacts/<id>`. Read `features/README.md`, then only the feature file you need.

Every helper finds the repository root itself, so you can run it from any directory. One run at a time: the helpers share one state file.

## Launch

```sh
skills/verify-vanillameta-mcp/launch.sh            # ports 3710 and 4710, Postgres on 5710
skills/verify-vanillameta-mcp/launch.sh 3720 4720  # other ports
```

Set `VM_COLIMA_PROFILE=<profile>` first when Docker runs in a colima profile.

`launch.sh` refuses to start when the web, API or Postgres port already has a listener. On this machine 3000 and 4000 belong to another stack, and a host process can hold 4100. It names the run `vm-artifacts-verify-<time>`, records the run in `~/.cache/vanillameta-verify/current.env`, then runs `scripts/verify/mcp-artifacts-e2e.sh` with `KEEP=1`. That script starts from an empty volume, builds, runs the scripted OAuth flow, creates the four artifact kinds, checks them in a browser, recreates every container, checks again, and runs the revoke race. A cold run takes about 10 minutes.

It is ready when the last lines read `결과: PASS=<n> FAIL=0` and `KEEP=1: 스택을 남겼습니다`. A FAIL line is a failure of the proof, not of the launch. The log is `$VM_EVIDENCE_DIR/run.log`, and `VM_EVIDENCE_DIR` is in the state file.

Before a build, check the Docker disk. One build adds about 3.5 GB: `colima ssh -p <profile> -- df -h /var/lib/docker`. Browser checks need Chromium: `cd frontend-web && npx playwright install chromium`.

## Doctor

```sh
skills/verify-vanillameta-mcp/doctor.sh
```

It restores the run from the state file, so it works in a new shell. It checks that the three containers of your project run, that Docker maps the API port to your API, API health, the web root, that unauthenticated `/mcp` answers 401, and that `ai_artifact` exists with its 10 columns. It also prints the processes that listen on the API port. Run it before every drive and again after any failed drive.

Doctor cannot prove that `localhost:<port>` reaches your containers. If a host process holds the port, Docker still reports your mapping and a second VanillaMeta server can answer the HTTP checks. The launch-time port check is the protection. If the INFO line names a process that is not your Docker VM, stop and investigate. In a colima profile the listener is `ssh`. Docker Desktop shows `com.docker.backend`.

## Drive

Full proof: Launch. Single feature on the kept stack: the recipe in `features/`. Shared setup for those recipes:

```sh
vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"        # restores VM_API_URL, VM_WEB_URL, VM_EVIDENCE_DIR
JWT=$(curl -s -H 'Content-Type: application/json' -d '{"userId":"guest","password":"Admin!@12"}' "$VM_API_URL/login/signin" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s -H "Authorization: Bearer $JWT" "$VM_API_URL/ai-artifacts"        # {"items":[{id,kind,title,...}]}
```

The seeded `guest` user starts without an organization. The e2e script creates one named `Verification`. A consent screen needs that membership.

## Evidence

Everything lands in `$VM_EVIDENCE_DIR`, outside the repo: `run.log`, `metadata.json`, `tools.json`, `consent-review.json`, `read-*.json`, `race-response.json`, and the `render-fresh/` and `render-restarted/` screenshots. Prove the action and the resulting state. A passing HTTP status alone is not proof.

- Artifact proof is the MCP call response, the REST read of the same id, and the browser screenshot of `/ai-artifacts/<id>`.
- A chart passes only if the canvas holds coloured data pixels. Axes and labels are grey and do not count.
- Write-revoke proof is the response text, the row count before and after, and a 401 on the next call.
- `consent-review.json` holds a one-time review token. Do not attach it outside this machine.

## Cleanup

```sh
skills/verify-vanillameta-mcp/cleanup.sh
```

It removes the containers, network and volumes of the recorded project and nothing else. It refuses any name that does not start with `vm-artifacts-verify-`, and it fails when it finds nothing to remove, so a lost state file cannot look like success. It never touches evidence, images, or other stacks (`vm-demo1123-*`, other colima profiles). Never reuse the name of an existing stack as `VM_PROJECT`. Never run `docker system prune`. Delete your own `vm-artifacts-verify-*` images only when the disk is full and the user agrees. Run cleanup after a failed run as well.

## Helpers

- `launch.sh`, `doctor.sh`, `restart.sh` and `cleanup.sh`, shown in the sections and recipes. `env.sh` restores the run variables. The scripts source it, and recipes load it with `vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"`, which works in zsh and bash and stops at the first error.
- `restart.sh` recreates every container with the same ports and MCP addresses, then waits for the API.
- `consent-check.mjs` opens the consent screen as `guest` and checks the preselected permissions. It never approves.

```sh
vars=$(skills/verify-vanillameta-mcp/env.sh) && eval "$vars"
WEB=$VM_WEB_URL API=$VM_API_URL SHOTS=$VM_EVIDENCE_DIR/consent node skills/verify-vanillameta-mcp/consent-check.mjs
```

- `scripts/verify/artifact-render-check.mjs` judges one or more artifact pages in a browser. Its input is the `ITEMS` JSON used in the feature recipes.

## Gotchas

- `env.sh` prefers variables already exported in the shell over the state file. After a new `launch.sh` in a terminal that kept an earlier run, open a new shell or run `unset VM_PROJECT VM_WEB_URL VM_API_URL VM_EVIDENCE_DIR` first.
- The state file records only the project, the two URLs, the evidence directory and the colima profile. Any other Compose override you set at launch is not restored, so set it again in the shell that runs `restart.sh`.
- Request the API with the exact host of `VM_API_URL`. The `/mcp` and `mcp-oauth` endpoints compare the `Host` header with it, so `127.0.0.1` against a `localhost` URL answers 403.
- The revoke probe holds the user row lock for 10 seconds. Do not write through the same account while it runs.
- In a colima profile without a Docker credential helper, `env.sh` points `DOCKER_CONFIG` at an empty directory under `~/.cache/vanillameta-verify/`. Do not read or edit `~/.docker/config.json`.
