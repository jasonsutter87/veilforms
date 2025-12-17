---
title: "Self Hosting"
description: "Deploy VeilForms on your own infrastructure"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Self Hosting

Deploy VeilForms on your own infrastructure for maximum control over your data. VeilForms is open source and can be self-hosted for free.

## Why Self-Host?

- **Complete data control** — Data never leaves your infrastructure
- **Compliance requirements** — Meet strict regulatory requirements
- **Custom integrations** — Deep integration with your systems
- **Air-gapped deployments** — No external network access required
- **Cost efficiency** — No per-submission fees or user limits
- **Custom domains** — Use your own domain for everything

## Quick Start with Docker Compose

The fastest way to get VeilForms running is with Docker Compose. This includes everything you need for production.

### 1. Clone the Repository

```bash
git clone https://github.com/veilforms/veilforms.git
cd veilforms/docker
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required: Change these immediately
POSTGRES_PASSWORD=your-secure-postgres-password
REDIS_PASSWORD=your-secure-redis-password
MINIO_ROOT_PASSWORD=your-secure-minio-password

# Required: Generate a strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Required: Set your domain
URL=https://forms.yourdomain.com
ALLOWED_ORIGINS=https://forms.yourdomain.com,https://yourdomain.com
```

### 3. Start Services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** - Database for users, forms, and metadata
- **Redis** - Rate limiting and caching
- **MinIO** - S3-compatible encrypted blob storage
- **VeilForms API** - Backend services
- **VeilForms Web** - Dashboard and static site
- **Nginx** - Reverse proxy with SSL and security

### 4. Access Your Installation

- **Dashboard**: http://localhost:8080
- **API Health**: http://localhost:3000/health
- **MinIO Console**: http://localhost:9001

Create your admin account at http://localhost:8080/register

For detailed setup instructions, see [`/docker/README.md`](https://github.com/veilforms/veilforms/blob/main/docker/README.md)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Your Infrastructure                                         │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Nginx Proxy │───▶│ API Server  │───▶│ PostgreSQL  │     │
│  │   SSL/TLS   │    │ (Node.js)   │    │  Database   │     │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘     │
│         │                  │                               │
│         │                  ├──────────▶┌─────────────┐     │
│         │                  │           │   Redis     │     │
│         │                  │           │   Cache     │     │
│         │                  │           └─────────────┘     │
│         │                  │                               │
│         │                  └──────────▶┌─────────────┐     │
│         │                              │   MinIO     │     │
│         │                              │ (S3 Blobs)  │     │
│         │                              └─────────────┘     │
│         │                                                   │
│         └─────────────────────────────▶┌─────────────┐     │
│                                        │ Static Site │     │
│                                        │   (Hugo)    │     │
│                                        └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## System Requirements

### Minimum (Development/Testing)

| Component | Requirement |
|-----------|-------------|
| CPU | 1 vCPU |
| Memory | 2GB RAM |
| Storage | 10GB SSD |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Docker | 20.10+ (if using Docker) |

### Recommended (Production)

| Component | Requirement |
|-----------|-------------|
| CPU | 2+ vCPU |
| Memory | 4GB+ RAM |
| Storage | 50GB+ SSD (depends on submission volume) |
| Node.js | 20 LTS |
| PostgreSQL | 15+ with replication |
| Load Balancer | For high availability |

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT signing (32+ chars) | `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `URL` | Base URL of your installation | `https://forms.example.com` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://example.com` |

### Storage Configuration

VeilForms supports any S3-compatible storage:

#### MinIO (Included in Docker setup)

```bash
BLOB_STORE_ENDPOINT=http://minio:9000
BLOB_STORE_BUCKET=veilforms
BLOB_STORE_ACCESS_KEY=minioadmin
BLOB_STORE_SECRET_KEY=minioadmin123
```

#### AWS S3

```bash
BLOB_STORE_ENDPOINT=https://s3.amazonaws.com
BLOB_STORE_BUCKET=your-bucket
BLOB_STORE_ACCESS_KEY=YOUR_AWS_ACCESS_KEY
BLOB_STORE_SECRET_KEY=YOUR_AWS_SECRET_KEY
BLOB_STORE_REGION=us-east-1
```

#### DigitalOcean Spaces

```bash
BLOB_STORE_ENDPOINT=https://nyc3.digitaloceanspaces.com
BLOB_STORE_BUCKET=your-space
BLOB_STORE_ACCESS_KEY=your-access-key
BLOB_STORE_SECRET_KEY=your-secret-key
BLOB_STORE_REGION=nyc3
```

#### Backblaze B2

```bash
BLOB_STORE_ENDPOINT=https://s3.us-west-002.backblazeb2.com
BLOB_STORE_BUCKET=your-bucket
BLOB_STORE_ACCESS_KEY=your-key-id
BLOB_STORE_SECRET_KEY=your-app-key
BLOB_STORE_REGION=us-west-002
```

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | - |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per minute | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |
| `STRIPE_SECRET_KEY` | Stripe API key (if using billing) | - |
| `RESEND_API_KEY` | Email API key (if using notifications) | - |
| `LOG_LEVEL` | Logging level | `info` |

## Using the Self-Hosted SDK

Point the SDK to your self-hosted instance:

```html
<!-- Use your own domain -->
<script src="https://forms.yourdomain.com/js/veilforms.min.js"></script>
<script>
  VeilForms.init('vf-abc123', {
    publicKey: 'your-public-key',
    endpoint: 'https://forms.yourdomain.com/api/submit'
  });
</script>
```

Or with NPM:

```javascript
import VeilForms from 'veilforms';

VeilForms.init('vf-abc123', {
  publicKey: 'your-public-key',
  endpoint: 'https://forms.yourdomain.com/api/submit'
});
```

## Production Deployment Checklist

Before going to production, ensure you've completed:

### Security

- [ ] Changed all default passwords in `.env`
- [ ] Generated strong JWT secret (32+ characters)
- [ ] Configured SSL/TLS certificates
- [ ] Set restrictive CORS origins
- [ ] Enabled HTTPS redirect in Nginx
- [ ] Configured firewall rules (only expose 80/443)
- [ ] Set `LOG_LEVEL=warn` or `LOG_LEVEL=error`
- [ ] Reviewed security headers in `nginx.conf`
- [ ] Disabled unnecessary ports

### Database

- [ ] Configured database backups (daily recommended)
- [ ] Set up connection pooling
- [ ] Configured PostgreSQL replication (optional)
- [ ] Reviewed database indexes
- [ ] Set up monitoring/alerting

### Storage

- [ ] Configured S3 bucket with proper permissions
- [ ] Enabled versioning on S3 bucket
- [ ] Set up cross-region replication (optional)
- [ ] Configured lifecycle policies for old data
- [ ] Tested backup and restore procedures

### Monitoring

- [ ] Set up health check monitoring
- [ ] Configured log aggregation
- [ ] Set up alerts for service failures
- [ ] Configured metrics collection
- [ ] Tested disaster recovery procedures

### Performance

- [ ] Configured Redis for rate limiting
- [ ] Set appropriate rate limits
- [ ] Enabled Nginx gzip compression
- [ ] Configured CDN for static assets (optional)
- [ ] Load tested your setup

## Backup & Recovery

### Database Backups

```bash
# Daily backup script
docker-compose exec postgres pg_dump -U veilforms veilforms | \
  gzip > backup-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c backup-20240115.sql.gz | \
  docker-compose exec -T postgres psql -U veilforms veilforms
```

### Storage Backups

Enable S3 versioning and replication:

```bash
# AWS S3 versioning
aws s3api put-bucket-versioning \
  --bucket your-bucket \
  --versioning-configuration Status=Enabled

# Cross-region replication
aws s3api put-bucket-replication \
  --bucket your-bucket \
  --replication-configuration file://replication.json
```

## Monitoring

### Health Checks

```bash
# API health
curl https://forms.yourdomain.com/api/health
# Response: {"status":"healthy","database":"connected","storage":"connected"}

# Nginx health
curl https://forms.yourdomain.com/health
# Response: healthy
```

### Logs

```bash
# View all service logs
docker-compose logs -f

# View API logs only
docker-compose logs -f api

# View last 100 lines
docker-compose logs --tail=100 api
```

### Metrics (Optional)

VeilForms can export metrics in Prometheus format:

```bash
curl https://forms.yourdomain.com/api/metrics
```

Integrate with Prometheus, Grafana, or your monitoring stack.

## Upgrading

```bash
# Pull latest changes
cd veilforms
git pull origin main

# Pull latest Docker images
cd docker
docker-compose pull

# Restart services
docker-compose up -d

# Run database migrations (if any)
docker-compose exec api npm run migrate
```

For zero-downtime upgrades, use rolling deployments with Kubernetes or Docker Swarm.

## Alternative Deployment Methods

### Kubernetes

Example Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: veilforms-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: veilforms-api
  template:
    metadata:
      labels:
        app: veilforms-api
    spec:
      containers:
      - name: api
        image: veilforms/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: veilforms-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Manual Installation (No Docker)

If you prefer not to use Docker:

1. **Install dependencies**:
   ```bash
   npm install
   cd netlify/functions && npm install
   ```

2. **Build assets**:
   ```bash
   npm run build
   ```

3. **Set up PostgreSQL**:
   ```sql
   CREATE DATABASE veilforms;
   CREATE USER veilforms WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE veilforms TO veilforms;
   ```

4. **Run migrations**:
   ```bash
   psql -U veilforms -d veilforms -f docker/init.sql
   ```

5. **Start services**:
   ```bash
   # API
   cd netlify/functions
   node server.js

   # Web (separate terminal)
   hugo server --bind 0.0.0.0 --baseURL https://your-domain.com
   ```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U veilforms -d veilforms -c "SELECT 1;"

# View PostgreSQL logs
docker-compose logs postgres
```

### Storage Connection Issues

```bash
# Check MinIO is running
docker-compose ps minio

# Access MinIO console
open http://localhost:9001

# Recreate bucket
docker-compose restart minio-setup
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services
docker-compose restart api

# Increase container limits in docker-compose.yml
```

### SSL/TLS Issues

```bash
# Test SSL configuration
openssl s_client -connect forms.yourdomain.com:443

# Verify certificates
openssl x509 -in ssl/cert.pem -text -noout

# Renew Let's Encrypt certificates
certbot renew
```

## Support & Resources

- **Docker Setup Guide**: [`/docker/README.md`](https://github.com/veilforms/veilforms/blob/main/docker/README.md)
- **GitHub Repository**: [github.com/veilforms/veilforms](https://github.com/veilforms/veilforms)
- **GitHub Issues**: [github.com/veilforms/veilforms/issues](https://github.com/veilforms/veilforms/issues)
- **Community Discussions**: [github.com/veilforms/veilforms/discussions](https://github.com/veilforms/veilforms/discussions)

## Next Steps

- [Key Management](/docs/guides/key-management/) — Secure your encryption keys
- [GDPR Compliance](/docs/guides/gdpr/) — Compliance in self-hosted deployments
- [API Reference](/docs/api/authentication/) — API documentation
- [SDK Configuration](/docs/sdk/configuration/) — Configure the SDK for self-hosting
