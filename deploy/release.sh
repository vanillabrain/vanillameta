#!/usr/bin/env bash
# Runs ON THE VM. Rolls the stack to an image tag, checks it, and goes back to the previous tag if the
# new one does not come up. Meant to be the forced command of the deploy key, so the key can do nothing else:
#   restrict,command="/opt/vanillameta/deploy/release.sh" ssh-ed25519 AAAA... github-deploy
# The workflow runs:  ssh host "release <tag> <ghcr-user>"  and sends a short-lived registry token on stdin.
# A rollback restores the previous IMAGES only. It does not undo migrations that already ran; for a
# release that changed the schema incompatibly, restore the pre-release backup (README "백업과 복원").
set -euo pipefail
umask 077
cd "$(dirname "$0")"

# A dropped SSH session or a cancelled job must not kill a release half way through, and a release with
# nobody reading still leaves a record on the VM (tee -p ignores a closed pipe).
trap '' PIPE HUP
exec 2> >(tee -p -a release.log >&2)

ENV_FILE="${ENV_FILE:-.env.prod}"
REGISTRY="${RELEASE_REGISTRY:-ghcr.io}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
log() { echo "[release] $*" >&2 || true; }
die() { log "ERROR: $*"; exit 1; }

args="${SSH_ORIGINAL_COMMAND:-$*}"
read -r action tag ghcr_user extra <<<"$args"
[ "${action:-}" = release ] && [ -z "${extra:-}" ] || die "usage: release <tag> [<ghcr-user>]"
[[ "${tag:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || die "invalid image tag"
if [ -n "${ghcr_user:-}" ]; then
  [[ "$ghcr_user" =~ ^[A-Za-z0-9-]{1,39}(\[bot\])?$ ]] || die "invalid registry user"
fi
[ -f "$ENV_FILE" ] || die "missing $ENV_FILE"

exec 9>.release.lock
flock -n 9 || die "another release is running"

# The workflow's registry token expires when its job ends, so it is kept in a throwaway client config
# and never replaces credentials the operator saved with `docker login` for manual releases.
login_dir=""
if [ -n "${ghcr_user:-}" ]; then
  IFS= read -r -t 15 token || true
  [ -n "${token:-}" ] || die "registry user given but no token on stdin"
  login_dir=$(mktemp -d)
  trap 'rm -rf "$login_dir"' EXIT
  real_cfg="${DOCKER_CONFIG:-$HOME/.docker}"
  [ -d "$real_cfg/cli-plugins" ] && ln -s "$real_cfg/cli-plugins" "$login_dir/cli-plugins"
  export DOCKER_CONFIG="$login_dir"
  printf '%s\n' "$token" | docker login "$REGISTRY" -u "$ghcr_user" --password-stdin >/dev/null
  unset token
  # A credential helper (pass, secretservice) on this host would keep the token outside login_dir.
  grep -q '"auth"' "$login_dir/config.json" 2>/dev/null \
    || { docker logout "$REGISTRY" >/dev/null 2>&1 || true; die "registry token was not stored in the throwaway config (credential helper in use?)"; }
fi

previous=$(grep -E '^IMAGE_TAG=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)
set_tag() {
  local t=$1 tmp
  tmp=$(mktemp ".env.prod.XXXXXX")
  awk -v t="$t" 'BEGIN{d=0} /^IMAGE_TAG=/{print "IMAGE_TAG=" t; d=1; next} {print} END{if(!d) print "IMAGE_TAG=" t}' "$ENV_FILE" > "$tmp"
  chmod --reference="$ENV_FILE" "$tmp" && mv "$tmp" "$ENV_FILE"
}

healthy() { [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" = healthy ]; }
wait_healthy() {
  local deadline=$((SECONDS + ${HEALTH_TIMEOUT:-180})) svc cid ok
  while [ "$SECONDS" -lt "$deadline" ]; do
    ok=true
    for svc in api web; do
      cid=$("${COMPOSE[@]}" ps -q "$svc" | head -1)
      [ -n "$cid" ] && healthy "$cid" || ok=false
    done
    [ "$ok" = true ] && return 0
    sleep 3
  done
  return 1
}
smoke() { "${COMPOSE[@]}" exec -T web wget -qO- http://127.0.0.1/v1/health | grep -q '"status":"ok"'; }
roll() { "${COMPOSE[@]}" up -d --remove-orphans && wait_healthy && smoke; }

# A release can migrate the schema forward, so keep a restorable copy first. A failed backup stops the
# release. The first release (no previous tag) has nothing to back up.
if [ -n "$previous" ] && [ -x ./backup.sh ]; then
  log "backing up before the release"
  ENV_FILE="$ENV_FILE" ./backup.sh >&2 || die "pre-release backup failed; nothing was changed"
fi

# From here until the release is settled, an unexpected exit (a signal, a failing command) puts the
# previous tag back and restarts it, instead of leaving .env.prod pointing at an unverified tag.
state=switching
# shellcheck disable=SC2329  # invoked through the EXIT trap below
recover() {
  local code=$?
  if [ "$state" = switching ] && [ -n "$previous" ]; then
    log "interrupted: restoring $previous"
    set_tag "$previous" || true
    # Still needs the throwaway DOCKER_CONFIG (compose plugin symlink, registry login), so remove it last.
    "${COMPOSE[@]}" up -d --remove-orphans >&2 || true
  fi
  rm -rf "${login_dir:-}"
  return "$code"
}
trap recover EXIT

log "pulling $tag"
set_tag "$tag"
if ! "${COMPOSE[@]}" pull api web >&2; then
  set_tag "$previous"
  state=settled
  die "pull failed; still on ${previous:-nothing}"
fi

log "starting $tag (previous: ${previous:-none})"
if roll >&2; then
  state=settled
  docker image prune -f >/dev/null 2>&1 || true
  echo "{\"released\":\"$tag\",\"previous\":\"${previous:-}\"}"
  exit 0
fi

log "release $tag did not become healthy"
"${COMPOSE[@]}" logs --tail 40 api migrate >&2 || true
if [ -n "$previous" ]; then
  log "rolling back to $previous"
  set_tag "$previous"
  state=settled
  if roll >&2; then die "rolled back to $previous; $tag was NOT released"; fi
  die "rollback to $previous also failed; the stack needs a manual look"
fi
state=settled
die "first release failed; there is nothing to roll back to"
