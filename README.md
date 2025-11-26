# Authelia Admin Control Panel

A web-based administration interface for managing Authelia authentication server.

![image](https://raw.githubusercontent.com/asalimonov/authelia-admin/refs/heads/main/public/authelia-admin.gif)

## Features

- View and manage TOTP configurations
- View TOTP history
- Managemenent of banned users and IPs
- Browse LDAP users and groups (due to LLDAP limitation)
- Change user passwords via LDAP

### Not yet implemented

- Management of users via LDAP
- PostgreSQL engine for Authelia
- Browse and management of users in Authelia file provider

## Configuration

- `AUTHELIA_DOMAIN` env var - domain of authelia server for authentication of requests
- `TRUSTED_ORIGINS` env var for Node application, example: `https://{{ AUTHELIA_DOMAIN }}`
- Configure load balancer, Authelia Admin CP should be on `https://{{AUTHELIA_DOMAIN}}/auth-admin/`

### Optional environment variables

- `MIN_AUTH_LEVEL` env var - minimal level of authentication, 2 for 2FA and 1 for password only, default 2
- `AUTHELIA_CONFIG_PATH` - Path to Authelia configuration file (default: `/config/configuration.yml`)
- `ALLOWED_USERS` - List of allowed users separated by comma (`,`), (default: `admin`)
- `NODE_TLS_REJECT_UNAUTHORIZED=0` in case of self-signed certificate for Authelia, or mount volume `/etc/ssl/certs/:/etc/ssl/certs/:ro` in Docker

### Docker

```bash
docker run -p 9093:9093 \
  -v /path/to/authelia/config:/config \
  -v /path/to/authelia/data:/data \
  ghcr.io/asalimonov/authelia-admin:latest
```

### Docker Compose

See `docker-compose.yml` for a complete example with Authelia, LLDAP, and Traefik.

### Development

```bash
# Install dependencies and build docker image
make build-dev

# Run Authelia, LLDAP, Traefik in docker compose in the second terminal
make docker-compose-run

# Run Docker with authelia-admin with hot-reload
make run-dev
```

Use `admin` user with `admin1234` password. Confirmation code is `./test-data/authelia/notification.txt` file.

## Requirements

- Node.js 20+
- Access to Authelia's configuration file
- Access to Authelia's SQLite database
- LDAP server (e.g., LLDAP) configured in Authelia

## Security Notes

>[!IMPORTANT]
Due to the age and experimental nature of the project, I don't recommend using it for public deployment or for installations with many users.

This application requires administrative access to Authelia's configuration and database. It should be deployed behind proper authentication and only accessible by authorized administrators.