#!/usr/bin/env bash
set -e

TIMEOUT=${TIMEOUT:-180}
INTERVAL=${INTERVAL:-3}

# Pre-check: DNS resolution (cross-platform: works on macOS and Linux)
for host in localhost.test auth.localhost.test ldap.localhost.test; do
  if ! python3 -c "import socket; socket.getaddrinfo('$host', None)" > /dev/null 2>&1; then
    echo "ERROR: Cannot resolve '$host'. Add to /etc/hosts:"
    echo "  127.0.0.1 localhost.test auth.localhost.test ldap.localhost.test"
    exit 1
  fi
done

# Health check polling function
# Usage: wait_for "name" "url" [extra_curl_flags]
wait_for() {
  local name="$1" url="$2"
  shift 2
  local extra_flags=("$@")
  local elapsed=0
  echo "Waiting for $name at $url ..."
  while ! curl -sf -o /dev/null "${extra_flags[@]}" "$url" 2>/dev/null; do
    sleep "$INTERVAL"
    elapsed=$((elapsed + INTERVAL))
    if [ "$elapsed" -ge "$TIMEOUT" ]; then
      echo "ERROR: Timeout waiting for $name ($url) after ${TIMEOUT}s"
      exit 1
    fi
  done
  echo "$name is ready (${elapsed}s)"
}

wait_for "LLDAP"           "http://localhost:17170"
wait_for "Authelia"        "http://localhost:9091/api/health"
wait_for "Authelia Admin"  "http://localhost:9093/auth-admin/health"
wait_for "Traefik (TLS)"   "https://auth.localhost.test" --insecure

echo "All services are ready!"
