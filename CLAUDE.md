# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Authelia Admin Control Panel - A web-based administration interface for managing Authelia authentication server. This application provides administrative controls for TOTP configurations, banned users/IPs, and LDAP user management.

## Tech Stack

- **Framework**: SvelteKit with Svelte 5 (new runes syntax)
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 with custom theme
- **i18n**: Inlang Paraglide JS v2 (English, Russian)
- **Database**: SQLite (via sqlite3 package)
- **LDAP**: ldapts library for LDAP operations
- **Build Tool**: Vite
- **Deployment**: Node adapter, builds to `build/` directory
- **Container**: Docker with Alpine Linux base

## Key Features

### Implemented
- View and manage TOTP configurations
- View TOTP history
- Management of users and groups in LLDAP
- Managemenent of banned users and IPs
- Dedicated role for management of regular users (user_manager)
- Dedicated role for  (user_manager)
- Roles: admin, user_manager (management of users), passowrd_manager (can change passwords). No access for regular users.

### Not yet implemented

- Management of attributes of users and groups
- Management of users and groups via LDAP protocol
- PostgreSQL engine for Authelia
- Browse and management of users in Authelia file provider

## Development Commands

All commands should be run inside docker environment

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Type checking with hot reload
npm run check:watch

# Single type check
npm run check

# Build for production
npm run build

# Preview production build (port 9093)
npm run preview

# Lint checking
npm run lint
```

## Make Commands

The project includes a comprehensive Makefile:

```bash
# Docker commands
make network       # Create Docker network if needed
make build         # Build production Docker image
make build-dev     # Build development Docker image
make run          # Run production container
make run-dev      # Run dev container with hot-reload
make stop         # Stop and remove container

# Docker Compose with test environment
make docker-compose-run  # Run full test stack (Authelia, LLDAP, Traefik)

# Testing (requires docker-compose-run for functional tests)
make test          # Run all tests (unit + functional)
make test-small    # Run unit tests only
make test-medium   # Run functional tests only
make test-lint     # Run ESLint on TypeScript code

# Cleanup
make clean         # Clean up images and local files
make network-remove # Remove Docker network
```

## Architecture

### Directory Structure

```
src/
├── lib/
│   └── server/
│       ├── database.ts          # SQLite adapter with optimizations
│       ├── ldap.ts              # LDAP client singleton class
│       └── directory-service/   # Directory service abstraction
├── routes/
│   ├── (app)/            # Protected routes requiring auth
│   │   ├── totp/         # TOTP management pages
│   │   │   ├── configurations/
│   │   │   └── history/
│   │   ├── banned/       # Banned users/IPs management
│   │   │   ├── users/
│   │   │   └── ip/
│   │   ├── users/        # LDAP user browsing
│   │   │   └── [userid]/ # User detail/edit page
│   │   └── groups/       # LDAP group browsing
│   └── +layout.server.ts # Authentication check
├── hooks.server.ts       # Authentication middleware
└── app.css              # Global styles with Tailwind
```

### Test Environment Structure

```
test-configs/
├── authelia/            # Authelia configuration
│   └── configuration.yml
├── lldap/              # LLDAP configuration
│   ├── lldap_config.toml
│   └── bootstrap/      # User/group initialization
└── traefik/            # Traefik reverse proxy
    └── traefik.yml
```

## Key Configuration

### Environment Variables

All configuration uses the `AAD_` prefix (Authelia Admin):

```bash
# Server Configuration
PORT=9093                                        # Server port
HOST=0.0.0.0                                     # Server host

# Config file path
AAD_CONFIG_PATH=/opt/authelia-admin/config.yml   # Path to config file

# Authelia Integration
AAD_AUTHELIA_DOMAIN=auth.localhost.test          # Authelia domain for auth
AAD_AUTHELIA_COOKIE_NAME=authelia_session        # Session cookie name
AAD_AUTHELIA_MIN_AUTH_LEVEL=2                    # Min auth level (1=password, 2=2FA)
AAD_AUTHELIA_ALLOWED_USERS=admin,user2           # Comma-separated allowed users, optional

# Directory Service (LLDAP GraphQL)
AAD_DIRECTORY_TYPE=lldap-graphql                 # Directory service type
AAD_DIRECTORY_LLDAP_GRAPHQL_ENDPOINT=http://lldap:17170/api/graphql
AAD_DIRECTORY_LLDAP_GRAPHQL_USER=admin           # LLDAP admin username
AAD_DIRECTORY_LLDAP_GRAPHQL_PASSWORD=secret      # LLDAP admin password
AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_HOST=lldap      # LDAP host for password changes
AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_PORT=3890       # LDAP port for password changes

# Security
TRUSTED_ORIGINS=https://auth.localhost.test      # CSRF trusted origins
NODE_TLS_REJECT_UNAUTHORIZED=0                   # Dev only - remove in production!
```

### Application Paths
- **Base Path**: `/auth-admin` (configured for reverse proxy)
- **Production Port**: 9093
- **Development Port**: 5173
- **Docker Network**: `authelia` (192.168.38.0/24)

## Implementation Details

### Authentication Flow
1. Check for `authelia_session` cookie
2. Validate session with Authelia API (`/api/state`)
3. Verify user is in `ALLOWED_USERS` list (allowed_users list is optional)
4. Require authentication level 2 (2FA) for admin access
5. Store user info in `event.locals.user`

### Database Operations
- SQLite adapter with 5-second busy timeout for Authelia concurrency
- Optimized delete operations using `result.changes` check
- Custom `dbRun` implementation for proper result handling
- Connection opened as READWRITE only

### Directory Service Abstraction

Located in `src/lib/server/directory-service/`, this abstraction provides a unified interface for user/group management across different directory backends.

**Structure:**
```
src/lib/server/directory-service/
├── index.ts              # Public API exports
├── types.ts              # Common interfaces (User, Group, IDirectoryService)
├── config.ts             # Configuration types for backends
├── factory.ts            # Service factory for creating instances
└── implementations/
    └── lldap-graphql/    # LLDAP GraphQL implementation
        ├── index.ts      # LLDAPGraphQLService class
        ├── client.ts     # GraphQL client with token management
        ├── queries.ts    # GraphQL queries
        ├── mutations.ts  # GraphQL mutations
        └── mappers.ts    # Type converters (LLDAP <-> common types)
```

**Usage:**
```typescript
import { getDirectoryServiceAsync } from '$lib/server/directory-service';

// Get the singleton service (initialized from config)
const service = await getDirectoryServiceAsync();
const users = await service.listUsers();
const user = await service.getUserDetails('admin');
```

**Configuration Format (config.yml):**
```yaml
directory:
  type: lldap-graphql
  lldap-graphql:
    endpoint: http://lldap:17170/api/graphql
    user: admin
    password: secret
    ldap_host: lldap
    ldap_port: 3890
```

**Key design decisions:**
- Group IDs are strings (UUIDs) at the interface level
- LLDAP implementation maps internal numeric IDs to UUIDs
- Thread-safe bearer token management with automatic refresh
- Configuration supports both YAML and environment variables (AAD_ prefix)

### Internationalization (i18n)

**MANDATORY**: All user-facing strings must be internationalized. This applies to both frontend (Svelte components) and backend (TypeScript server code).

**Library**: [Inlang Paraglide JS v2](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) (`@inlang/paraglide-js`)

**Supported Languages**:
- English (en) - default/base locale
- Russian (ru)

**Structure:**
```
messages/
├── en.json          # English translations (source of truth)
└── ru.json          # Russian translations
src/lib/paraglide/
├── messages.js      # Auto-generated message functions
└── runtime.js       # Runtime utilities
```

**Configuration** (`project.inlang/settings.json`):
- Base locale: `en`
- Locale strategy: `['cookie', 'baseLocale']` - uses cookie first, falls back to English

**Usage in Code:**

```typescript
// Import messages namespace
import * as m from '$lib/paraglide/messages';

// Simple message
const error = m.auth_required();

// Message with parameters
const error = m.user_not_found({ userId: 'john' });

// In SvelteKit form actions with fail()
return fail(400, { error: m.validation_email_invalid() });

// In hooks with error()
import { error } from '@sveltejs/kit';
error(403, m.auth_required());
```

**Adding New Messages:**

1. Add the key to `messages/en.json`:
   ```json
   {
     "my_new_message": "This is a new message",
     "my_message_with_param": "Hello, {name}!"
   }
   ```

2. Add the same key to `messages/ru.json` with Russian translation:
   ```json
   {
     "my_new_message": "Это новое сообщение",
     "my_message_with_param": "Привет, {name}!"
   }
   ```

3. Run `npm run build` or `npm run dev` to regenerate `src/lib/paraglide/messages.js`

4. Use in code:
   ```typescript
   import * as m from '$lib/paraglide/messages';
   m.my_new_message();
   m.my_message_with_param({ name: 'World' });
   ```

**Message Key Naming Conventions:**
- Use snake_case for keys
- Prefix with feature area: `user_`, `group_`, `totp_`, `banned_`, `auth_`, `validation_`, `access_`, `common_`, `db_`
- Be descriptive: `user_password_change_success`, `validation_email_invalid`
- Don't use `server_` prefix - messages are shared between frontend and backend

**What NOT to Internationalize:**
- Console log messages (debug/error logging)
- Technical error messages not shown to users
- Internal identifiers

### Security Measures
- CSRF protection via `trustedOrigins`
- Session validation on each request
- Server-side input validation
- Parameterized SQL queries
- Authentication level checking

## Common Issues and Solutions

### 1. TOTP Deletion Error (ECONNRESET)
**Cause**: SQLite database locked by Authelia  
**Fix**: Implemented 5-second busy timeout and optimized queries

### 2. Architecture Mismatch Error
**Cause**: sqlite3 binary for wrong architecture  
**Fix**: `npm rebuild sqlite3 --build-from-source`

### 3. Module Not Found in Docker
**Cause**: Volume mount overriding build directory  
**Fix**: Removed `-v $(PWD):/app` from production run

### 4. Cannot read properties of undefined ('changes')
**Cause**: Incorrect promisify of db.run  
**Fix**: Custom dbRun implementation with proper callback handling

## Security Notes

⚠️ **IMPORTANT**: This is an experimental project not recommended for public deployment or installations with many users.

### Required Security Fixes Before Production
1. Enable proper CSRF protection (currently using trustedOrigins)
2. Remove `NODE_TLS_REJECT_UNAUTHORIZED=0`
3. Implement LDAP input escaping to prevent injection
4. Add rate limiting on sensitive operations
5. Implement comprehensive audit logging
6. Add security headers (CSP, X-Frame-Options, HSTS)
7. Enforce 2FA for all admin operations
8. Implement session timeout
9. Add input length limits and validation

## Testing Checklist

- [ ] Authentication flow with Authelia
- [ ] TOTP configuration deletion
- [ ] Banned user/IP creation and deletion
- [ ] LDAP user browsing
- [ ] Password change functionality
- [ ] Session validation
- [ ] CSRF protection
- [ ] Error handling and recovery

## Troubleshooting Commands

```bash
# Check Authelia Integration
curl -H "Cookie: authelia_session=..." https://auth.localhost.test/api/state

# Verify Database Access
sqlite3 /data/authelia.db ".tables"

# Test LDAP Connection
ldapsearch -H ldap://lldap:3890 -D "uid=admin,ou=people,dc=localhost,dc=test" -w admin1234 -b "dc=localhost,dc=test"

# View Docker Logs
docker logs authelia-admin -f

# Rebuild Native Modules
npm rebuild sqlite3 --build-from-source
```

## Future Improvements
1. Implement full RBAC (role-based access control)
2. Add PostgreSQL support for Authelia storage
3. Create user management for file-based provider
4. Add comprehensive audit logging
5. Implement automated testing suite
6. Create Helm chart for Kubernetes
7. Add metrics and monitoring
8. Implement backup/restore functionality

## Important Notes for Development

- TypeScript strict mode is enabled - ensure all types are properly defined
- The project uses Svelte 5 with new runes syntax (`$props()`, `$state()`)
- **All user-facing strings must be internationalized** - use `import * as m from '$lib/paraglide/messages'` and add translations to both `messages/en.json` and `messages/ru.json`
- Always use `getDirectoryServiceAsync()` to get the directory service instance
- Database connections must be properly closed after operations
- All user inputs must be validated server-side
- Keep sensitive data (passwords, secrets) out of logs
- Use parameterized queries for all database operations
- Test with both Authelia and LLDAP running