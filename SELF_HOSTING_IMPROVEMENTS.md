# Self-Hosting & Infrastructure Improvements

This document summarizes all the self-hosting and infrastructure improvements added to VeilForms.

## Overview

VeilForms is now fully self-hostable with production-ready Docker Compose setup, comprehensive documentation, and enhanced security features including SRI hashes for SDK integrity.

## What's New

### 1. Docker Compose Setup (`/docker/`)

Complete Docker-based deployment with all required services:

#### Services Included
- **PostgreSQL 16** - Primary database with initialization scripts
- **Redis 7** - Rate limiting and caching
- **MinIO** - S3-compatible blob storage with automatic bucket creation
- **VeilForms API** - Netlify Functions containerized
- **VeilForms Web** - Hugo static site with Nginx
- **Nginx** - Reverse proxy with SSL/TLS, rate limiting, and security headers

#### Key Files
- `docker-compose.yml` - Complete orchestration of all services
- `Dockerfile.api` - API container build
- `Dockerfile.web` - Static site build with Hugo
- `nginx.conf` - Production reverse proxy configuration
- `nginx-web.conf` - Static site Nginx config
- `init.sql` - PostgreSQL schema initialization
- `.env.example` - Complete environment variable template
- `README.md` - Comprehensive setup guide

### 2. Environment Configuration

**File**: `/docker/.env.example`

Production-ready environment template with:
- Required variables clearly marked
- Security best practices
- Production deployment checklist
- Support for optional features (Stripe, email)
- Rate limiting configuration
- Logging configuration

**Key Features**:
- PostgreSQL with connection pooling
- Redis for performance
- S3-compatible storage (MinIO, AWS S3, DigitalOcean Spaces, Backblaze B2)
- JWT authentication
- CORS configuration
- Optional Stripe integration
- Optional Resend email integration

### 3. Updated Self-Hosting Documentation

**File**: `/content/docs/guides/self-hosting.md`

**Major Changes**:
- ✅ Removed "contact sales" barrier - now truly open source
- ✅ Added Docker Compose quick start (4 commands to production)
- ✅ Complete environment variables reference
- ✅ Production deployment checklist with security hardening
- ✅ Multiple storage provider examples
- ✅ Backup and recovery procedures
- ✅ Monitoring and health checks
- ✅ Troubleshooting guide
- ✅ Kubernetes deployment example
- ✅ Manual installation (no Docker) guide

### 4. SRI (Subresource Integrity) Hashes

**What**: Cryptographic hashes that verify SDK files haven't been tampered with

**Generated Hashes**:
- **veilforms.min.js**: `sha384-dxvu/QuhQhLna10DbAj9KnYMewa6zqats5B79Pv+Ae3ef2pfwjRLrRSJ76SEtWMp`
- **veilforms.esm.js**: `sha384-hQ0Lff/lzvzuHG86JRh4P+NgzhDt9ZJE8BmjD44eX0zizRX3YIGoGXrlAieSyj99`

**Benefits**:
- Protects against CDN compromises
- Prevents man-in-the-middle attacks
- Ensures supply chain security
- Browser validates before executing

**Updated Files**:
- `/content/docs/sdk/installation.md` - Full SRI section with examples
- `/content/docs/quickstart.md` - All examples include SRI
- `/layouts/index.html` - Homepage code examples use SRI

### 5. Encryption Flow Diagram

**File**: `/layouts/index.html`

**New Visual Feature**:
- SVG diagram showing encryption flow
- Visual representation: Browser → Encrypt → API → Store (encrypted)
- Color-coded stages with clear labels
- Mobile-responsive design
- Animated arrows showing data flow
- Clear "Zero-Knowledge" messaging

**Design**:
- Browser (blue) - Shows plaintext form data
- Client-Side Encryption (green) - Lock icon, encryption happens here
- API (orange) - "No Access to Plaintext"
- Blob Storage (purple) - "Encrypted Data (Ciphertext)"

### 6. Production-Ready Database Schema

**File**: `/docker/init.sql`

Complete PostgreSQL schema with:
- Users table with email verification
- Forms table with encryption keys
- Submissions table with encrypted data
- API keys table with permissions
- Audit logs for compliance
- Subscriptions for billing
- Optimized indexes for performance
- Automatic `updated_at` triggers

### 7. Security Hardening

**Nginx Configuration**:
- Rate limiting (100 req/min general, 30 req/min for submissions)
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- SSL/TLS configuration with modern ciphers
- Gzip compression
- Health check endpoints

**Application Security**:
- Environment variable validation
- Strong JWT secrets required (32+ chars)
- CORS configuration
- Secrets management examples (AWS Secrets Manager, Vault)

## Quick Start

```bash
# Clone repository
git clone https://github.com/veilforms/veilforms.git
cd veilforms/docker

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose up -d

# Access dashboard
open http://localhost:8080
```

## File Structure

```
veilforms/
├── docker/
│   ├── docker-compose.yml       # Service orchestration
│   ├── .env.example             # Environment template
│   ├── Dockerfile.api           # API container
│   ├── Dockerfile.web           # Web container
│   ├── nginx.conf               # Reverse proxy config
│   ├── nginx-web.conf           # Static site config
│   ├── init.sql                 # Database schema
│   └── README.md                # Setup guide
├── content/docs/guides/
│   └── self-hosting.md          # Updated docs (no sales barrier)
├── content/docs/sdk/
│   └── installation.md          # Updated with SRI hashes
├── layouts/
│   └── index.html               # Homepage with encryption diagram
└── assets/scss/pages/
    └── home.scss                # Diagram styling
```

## Environment Variables

### Required
- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `MINIO_ROOT_PASSWORD` - Storage password
- `JWT_SECRET` - Authentication secret (32+ chars)
- `URL` - Your domain
- `ALLOWED_ORIGINS` - CORS origins

### Optional
- `STRIPE_SECRET_KEY` - Payment integration
- `RESEND_API_KEY` - Email notifications
- `RATE_LIMIT_MAX_REQUESTS` - Rate limiting
- `LOG_LEVEL` - Logging verbosity

## Storage Providers Supported

- ✅ MinIO (included in Docker setup)
- ✅ AWS S3
- ✅ DigitalOcean Spaces
- ✅ Backblaze B2
- ✅ Any S3-compatible storage

## Production Checklist

Before deploying to production:

### Security
- [ ] Change all default passwords
- [ ] Generate strong JWT secret
- [ ] Configure SSL/TLS certificates
- [ ] Set restrictive CORS origins
- [ ] Enable HTTPS redirect
- [ ] Configure firewall (only 80/443)
- [ ] Review security headers
- [ ] Set production log level

### Database
- [ ] Configure daily backups
- [ ] Set up connection pooling
- [ ] Configure replication (optional)
- [ ] Review indexes
- [ ] Set up monitoring

### Storage
- [ ] Configure S3 with proper permissions
- [ ] Enable versioning
- [ ] Set up cross-region replication (optional)
- [ ] Configure lifecycle policies
- [ ] Test backup/restore

### Monitoring
- [ ] Set up health check monitoring
- [ ] Configure log aggregation
- [ ] Set up failure alerts
- [ ] Configure metrics collection
- [ ] Test disaster recovery

### Performance
- [ ] Configure Redis
- [ ] Set appropriate rate limits
- [ ] Enable gzip compression
- [ ] Configure CDN (optional)
- [ ] Load test your setup

## Benefits of These Improvements

### For Users
1. **True Open Source** - No sales barriers, actually self-hostable
2. **Production Ready** - Docker setup works out of the box
3. **Security First** - SRI hashes, security headers, rate limiting
4. **Cost Effective** - No per-submission fees, unlimited users
5. **Complete Control** - Your infrastructure, your data, your rules

### For Privacy
1. **Zero-Knowledge** - Data encrypted before leaving browser
2. **Visual Education** - Diagram shows exactly how encryption works
3. **Verifiable Security** - SRI ensures SDK integrity
4. **Compliance Ready** - GDPR, HIPAA, SOC 2 compatible

### For Developers
1. **Simple Setup** - 4 commands to production
2. **Clear Documentation** - Step-by-step guides
3. **Flexible Deployment** - Docker, Kubernetes, or manual
4. **Multiple Storage Options** - Use any S3-compatible service
5. **Monitoring Built In** - Health checks, logs, metrics

## Testing the Setup

```bash
# Start services
docker-compose up -d

# Check all services are healthy
docker-compose ps

# Test API health
curl http://localhost:3000/health

# Test web health
curl http://localhost:8080

# View logs
docker-compose logs -f
```

## Upgrading

```bash
# Pull latest changes
git pull origin main

# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Run migrations (if any)
docker-compose exec api npm run migrate
```

## Backup

```bash
# Database backup
docker-compose exec postgres pg_dump -U veilforms veilforms | \
  gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20240115.sql.gz | \
  docker-compose exec -T postgres psql -U veilforms veilforms
```

## Support

- **Documentation**: `/docker/README.md` and `/docs/guides/self-hosting/`
- **GitHub Issues**: For bugs and feature requests
- **Community**: GitHub Discussions

## License

MIT License - Free to use, modify, and distribute.

---

**Status**: ✅ Production Ready

All features tested and documented. Ready for self-hosted deployments.
