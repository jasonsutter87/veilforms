---
title: "Self Hosting"
description: "Deploy VeilForms on your own infrastructure"
layout: "docs"
---

# Self Hosting

Deploy VeilForms on your own infrastructure for maximum control over your data.

<div class="callout info">
<strong>Enterprise Feature:</strong> Self-hosting is available on Enterprise plans. Contact sales@veilforms.com for licensing.
</div>

## Why Self-Host?

- **Complete data control** — Data never leaves your infrastructure
- **Compliance requirements** — Meet strict regulatory requirements
- **Custom integrations** — Deep integration with your systems
- **Air-gapped deployments** — No external network access required
- **Custom domains** — Use your own domain for everything

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Your Infrastructure                                         │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ CDN/Proxy   │───▶│ API Server  │───▶│ Database    │     │
│  │ (optional)  │    │ (Node.js)   │    │ (Postgres)  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                               │
│         │                  ▼                               │
│         │           ┌─────────────┐                        │
│         │           │ Blob Store  │                        │
│         │           │ (S3/MinIO)  │                        │
│         │           └─────────────┘                        │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ Static Site │  (Dashboard, SDK)                         │
│  └─────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Requirements

### Minimum

| Component | Requirement |
|-----------|-------------|
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Storage | S3-compatible (AWS S3, MinIO, etc.) |
| Memory | 512MB+ |
| CPU | 1 vCPU |

### Recommended (Production)

| Component | Requirement |
|-----------|-------------|
| Node.js | 20 LTS |
| PostgreSQL | 15+ with replication |
| Storage | S3 with versioning |
| Memory | 2GB+ |
| CPU | 2+ vCPU |
| Load Balancer | For high availability |

## Quick Start with Docker

### 1. Clone the Repository

```bash
git clone https://github.com/veilforms/veilforms-server.git
cd veilforms-server
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/veilforms

# Storage (S3-compatible)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=veilforms
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Security
JWT_SECRET=your-secure-random-string
ENCRYPTION_KEY=your-32-byte-hex-key

# Optional
SMTP_HOST=smtp.example.com
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
```

### 3. Start Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database
- MinIO (S3-compatible storage)
- VeilForms API server
- VeilForms dashboard

### 4. Initialize Database

```bash
docker-compose exec api npm run db:migrate
docker-compose exec api npm run db:seed
```

### 5. Access Dashboard

Open `http://localhost:3000` and create your admin account.

## Manual Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL

```sql
CREATE DATABASE veilforms;
CREATE USER veilforms WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE veilforms TO veilforms;
```

### 3. Set Up S3 Storage

Using AWS S3:

```bash
aws s3 mb s3://your-veilforms-bucket
```

Or MinIO locally:

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password \
  minio/minio server /data --console-address ":9001"
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Start Server

```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `S3_ENDPOINT` | S3 endpoint URL | Required |
| `S3_BUCKET` | S3 bucket name | Required |
| `S3_ACCESS_KEY` | S3 access key | Required |
| `S3_SECRET_KEY` | S3 secret key | Required |
| `S3_REGION` | S3 region | `us-east-1` |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `JWT_EXPIRY` | JWT expiration time | `7d` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `RATE_LIMIT` | Requests per minute | `100` |
| `LOG_LEVEL` | Logging level | `info` |

### Database Configuration

For production, use connection pooling:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/veilforms?pool_min=2&pool_max=10
```

### Storage Configuration

#### AWS S3

```bash
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_REGION=us-east-1
```

#### DigitalOcean Spaces

```bash
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_BUCKET=your-space
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=nyc3
```

#### Backblaze B2

```bash
S3_ENDPOINT=https://s3.us-west-002.backblazeb2.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your-key-id
S3_SECRET_KEY=your-app-key
S3_REGION=us-west-002
```

## SDK Configuration

Point the SDK to your self-hosted instance:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  endpoint: 'https://forms.yourdomain.com/api/submit'
});
```

## Deploying to Production

### Kubernetes

```yaml
# deployment.yaml
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
        image: veilforms/server:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: veilforms-secrets
              key: database-url
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: veilforms-secrets
              key: s3-access-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Terraform (AWS)

```hcl
# main.tf
module "veilforms" {
  source = "github.com/veilforms/terraform-aws-veilforms"

  name              = "veilforms"
  vpc_id            = var.vpc_id
  subnet_ids        = var.private_subnet_ids
  instance_type     = "t3.small"
  min_instances     = 2
  max_instances     = 10
  database_instance = "db.t3.micro"

  tags = {
    Environment = "production"
  }
}
```

### Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'
services:
  api:
    image: veilforms/server:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    environment:
      - DATABASE_URL_FILE=/run/secrets/db_url
    secrets:
      - db_url
      - s3_credentials

secrets:
  db_url:
    external: true
  s3_credentials:
    external: true
```

## Security Hardening

### Network Security

```bash
# Only expose necessary ports
# API: 3000 (internal only, behind load balancer)
# Dashboard: 443 (public, via CDN)
```

### Database Security

```sql
-- Use separate roles
CREATE ROLE veilforms_api WITH LOGIN PASSWORD 'xxx';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO veilforms_api;

-- Read-only role for analytics
CREATE ROLE veilforms_readonly WITH LOGIN PASSWORD 'yyy';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO veilforms_readonly;
```

### Secrets Management

Use a secrets manager:

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name veilforms/production/database \
  --secret-string '{"url":"postgresql://..."}'

# HashiCorp Vault
vault kv put secret/veilforms/database url="postgresql://..."
```

## Monitoring

### Health Checks

```bash
curl https://forms.yourdomain.com/health
# {"status":"healthy","version":"1.0.0","database":"connected","storage":"connected"}
```

### Prometheus Metrics

```bash
curl https://forms.yourdomain.com/metrics
# veilforms_submissions_total{form="vf-abc123"} 142
# veilforms_api_requests_total{method="POST",path="/api/submit"} 1523
# veilforms_api_latency_seconds{quantile="0.99"} 0.145
```

### Logging

```javascript
// Structured JSON logging
{"level":"info","timestamp":"2024-01-15T10:30:00Z","message":"Submission received","formId":"vf-abc123","submissionId":"vf-xyz789"}
```

## Backup & Recovery

### Database Backup

```bash
# Daily backup
pg_dump -Fc veilforms > backup-$(date +%Y%m%d).dump

# Restore
pg_restore -d veilforms backup-20240115.dump
```

### Storage Backup

Enable S3 versioning and cross-region replication:

```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket \
  --versioning-configuration Status=Enabled
```

## Upgrades

### Rolling Upgrade

```bash
# Pull latest
docker pull veilforms/server:latest

# Rolling restart (zero downtime)
docker service update --image veilforms/server:latest veilforms_api
```

### Database Migrations

```bash
# Run migrations before deploying new version
docker-compose exec api npm run db:migrate

# Rollback if needed
docker-compose exec api npm run db:migrate:rollback
```

## Support

For self-hosted support:

- **Documentation**: [docs.veilforms.com/self-hosting](https://docs.veilforms.com/self-hosting)
- **GitHub Issues**: [github.com/veilforms/veilforms-server/issues](https://github.com/veilforms/veilforms-server/issues)
- **Enterprise Support**: support@veilforms.com

## Next Steps

- [Key Management](/docs/guides/key-management/) — Secure your keys in self-hosted deployments
- [GDPR Compliance](/docs/guides/gdpr/) — Compliance with self-hosting
- [API Reference](/docs/api/authentication/) — API documentation
