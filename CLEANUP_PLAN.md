# 🧹 Post-Migration Cleanup Plan
*Docker → Cloudflare Migration Cleanup Initiative*

## Overview
Following the successful migration from Docker deployment to Cloudflare Workers, this plan outlines the systematic removal of obsolete infrastructure, dependencies, and configuration files.

## Cleanup Phases

### Phase 1: Immediate Safe Removal ✅ **READY FOR EXECUTION**

**Docker Infrastructure** (Safe to remove immediately)
- [ ] `Dockerfile` - Django/Vite container definition
- [ ] `docker-compose.yml` - Main Docker Compose configuration
- [ ] `docker-compose.local.yml` - Local development setup
- [ ] `docker-compose.web-dev.yml` - Dev deployment configuration
- [ ] `docker-compose.web-latest.yml` - Production deployment
- [ ] `nginx/default.conf` - Nginx proxy configuration
- [ ] `nginx/` directory (entire)

**Build and Deployment Scripts** (Docker-specific)
- [ ] `scripts/deploy.sh` - Docker Compose deployment script
- [ ] `Makefile` - Docker container management commands
- [ ] `app/scripts/cmd-web.sh` - Container startup script
- [ ] `app/scripts/wait-for-it.sh` - Database connection utility

**Obsolete Directories**
- [ ] `workers/node_modules/` - Old workers directory with stale node_modules

### Phase 2: Dependency and Configuration Cleanup ⚠️ **REQUIRES VERIFICATION**

**Python Dependencies** (Remove from `pyproject.toml`)
- [ ] `psycopg2-binary (>=2.9.10,<3.0.0)` - PostgreSQL adapter
- [ ] `asyncpg (>=0.28.0,<1.0.0)` - Async PostgreSQL driver
- [ ] `neomodel (>=5.4.3,<6.0.0)` - Neo4j ORM (if not used)
- [ ] Review: `gunicorn` (may not be needed for Cloudflare Workers)

**Django Settings Cleanup**
- [ ] Remove PostgreSQL database configurations from `app/config/settings/dev.py`
- [ ] Remove PostgreSQL database configurations from `app/config/settings/prod.py`
- [ ] Clean up Neo4j Docker-specific connection strings

**Environment Configuration**
- [ ] Update `.env.example` to remove PostgreSQL variables
- [ ] Review Docker-specific environment variables across all config files

### Phase 3: Post-Migration Cleanup 🚧 **DEFER UNTIL MIGRATION COMPLETE**

**Migration Artifacts** (Keep until migration is verified complete)
- [ ] `migration.yaml` - Migration configuration
- [ ] `requirements-migration.txt` - Migration-specific requirements
- [ ] `.env.migration.template` - Migration environment template
- [ ] All migration scripts in `scripts/` directory
- [ ] PostgreSQL environment variables (after D1 migration verified)

## Execution Strategy

### Subagent Assignment
1. **🗑️ DockerDestroyer** - Phase 1 Docker infrastructure removal
2. **📦 DependencyDuster** - Phase 2 dependency cleanup
3. **🔧 ConfigCleaner** - Phase 2 configuration file updates
4. **🚚 MigrationMaid** - Phase 3 post-migration cleanup (deferred)

### Safety Protocols
- [ ] Create backup commit before each phase
- [ ] Test Cloudflare deployment after Phase 1
- [ ] Verify application functionality after Phase 2
- [ ] Keep migration tools until D1 migration is verified complete

### Risk Assessment
- **Low Risk**: Docker infrastructure (Phase 1) - safe immediate removal
- **Medium Risk**: Dependencies (Phase 2) - test thoroughly after changes
- **High Risk**: Migration tools (Phase 3) - defer until migration complete

## Success Criteria
- [ ] All Docker references removed from codebase
- [ ] Application deploys successfully to Cloudflare
- [ ] No broken dependencies or imports
- [ ] Clean, maintainable codebase optimized for Cloudflare Workers
- [ ] Significant reduction in repository size and complexity

## Rollback Plan
- Git history preservation for all removed files
- Tagged commits before each cleanup phase
- Documented restoration process for critical files if needed

---
*Generated as part of the Docker → Cloudflare migration cleanup initiative*