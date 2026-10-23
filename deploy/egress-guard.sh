#!/usr/bin/env bash
# Stops the api container from opening connections to private, link-local (cloud metadata) and loopback
# addresses. Defense in depth behind ALLOWED_SOURCE_TYPES: even if a user-supplied host ever reached a
# socket, the network refuses it. Public addresses (the LLM provider) stay reachable.
# Run as root on the VM after docker is up; install the systemd unit to reapply it on boot.
# IPv4 only: the egress network has no IPv6, keep it that way (there are no ip6tables rules).
# Limits: containers restart with dockerd before the unit reapplies the rules (a short unguarded
# window at boot), and Docker's nftables backend has no DOCKER-USER chain. Verify on the real VM type.
# Usage: egress-guard.sh [apply|remove|status]
set -euo pipefail

SUBNET="${EGRESS_SUBNET:-172.29.40.0/24}"   # must match networks.egress in docker-compose.prod.yml
CHAIN=VM_EGRESS_GUARD
IN_CHAIN=VM_EGRESS_GUARD_IN

# IPv4 upstream resolvers: what systemd-resolved really uses, plus /etc/resolv.conf.
resolvers() {
  { cat /run/systemd/resolve/resolv.conf /etc/resolv.conf 2>/dev/null || true; } \
    | awk '$1 == "nameserver" && $2 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {print $2}' | sort -u
}

apply() {
  iptables -N "$CHAIN" 2>/dev/null || iptables -F "$CHAIN"
  iptables -A "$CHAIN" -d "$SUBNET" -j RETURN
  # Docker's embedded DNS forwards lookups from the container's namespace to the host's upstream
  # resolvers. On cloud VMs those sit inside the private ranges below (AWS 169.254.169.253 / VPC+2, GCP
  # 169.254.169.254), so they are allowed for port 53 only, before the DROP rules.
  for resolver in $(resolvers); do
    iptables -A "$CHAIN" -p udp -d "$resolver" --dport 53 -j RETURN
    iptables -A "$CHAIN" -p tcp -d "$resolver" --dport 53 -j RETURN
  done
  for net in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4; do
    iptables -A "$CHAIN" -d "$net" -j DROP
  done
  iptables -A "$CHAIN" -j RETURN
  iptables -C DOCKER-USER -s "$SUBNET" -j "$CHAIN" 2>/dev/null || iptables -I DOCKER-USER 1 -s "$SUBNET" -j "$CHAIN"

  # Traffic addressed to the host itself (its own services, SSH, the docker gateway) is not forwarded.
  iptables -N "$IN_CHAIN" 2>/dev/null || iptables -F "$IN_CHAIN"
  iptables -A "$IN_CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
  iptables -A "$IN_CHAIN" -j DROP
  iptables -C INPUT -s "$SUBNET" -j "$IN_CHAIN" 2>/dev/null || iptables -I INPUT 1 -s "$SUBNET" -j "$IN_CHAIN"
  echo "egress guard applied for $SUBNET"
}

remove() {
  iptables -D DOCKER-USER -s "$SUBNET" -j "$CHAIN" 2>/dev/null || true
  iptables -D INPUT -s "$SUBNET" -j "$IN_CHAIN" 2>/dev/null || true
  for c in "$CHAIN" "$IN_CHAIN"; do
    iptables -F "$c" 2>/dev/null || true
    iptables -X "$c" 2>/dev/null || true
  done
  echo "egress guard removed"
}

case "${1:-apply}" in
  apply) apply ;;
  remove) remove ;;
  status) iptables -S "$CHAIN" 2>/dev/null && iptables -S "$IN_CHAIN" 2>/dev/null || echo "not applied" ;;
  *) echo "usage: $0 [apply|remove|status]" >&2; exit 2 ;;
esac
