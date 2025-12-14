# VeilForms Self-Hosting with Docker

Deploy VeilForms on your own infrastructure using Docker Compose. This setup includes everything you need for a production-ready deployment.

## What's Included

- **PostgreSQL** - Primary database for users, forms, and submissions
- **Redis** - Rate limiting and session caching
- **MinIO** - S3-compatible blob storage for encrypted submissions
- **VeilForms API** - Netlify Functions running as a containerized service
- **VeilForms Web** - Hugo static site with the dashboard
- **Nginx** - Reverse proxy with SSL termination and rate limiting

## Quick Start

### 1. Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- At least 2GB RAM available
- Ports 80, 443, 3000, 5432, 6379, 9000, 9001 available

### 2. Clone the Repository

```bash
git clone https://github.com/veilforms/veilforms.git
cd veilforms/docker
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```bash
# REQUIRED: Change these immediately
POSTGRES_PASSWORD=your-secure-postgres-password
REDIS_PASSWORD=your-secure-redis-password
MINIO_ROOT_PASSWORD=your-secure-minio-password

# REQUIRED: Generate a strong JWT secret
# Run: openssl rand -base64 32
JWT_SECRET=your-generated-jwt-secret-here

# REQUIRED: Set your domain
URL=https://forms.yourdomain.com
ALLOWED_ORIGINS=https://forms.yourdomain.com,https://yourdomain.com
```

### 4. Generate SSL Certificates (Production)

For development, you can skip SSL. For production:

```bash
# Create SSL directory
mkdir -p ssl

# Option 1: Use Let's Encrypt (recommended)
# Install certbot and run:
certbot certonly --standalone -d forms.yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/forms.yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/forms.yourdomain.com/privkey.pem ssl/key.pem

# Option 2: Self-signed certificate (development only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem
```

### 5. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 6. Access Your Installation

- **Dashboard**: http://localhost:8080 (or your domain)
- **API**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (admin interface)

### 7. Create Your First User

Visit http://localhost:8080/register and create an account.

## Service Ports

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Nginx | 80, 443 | 80, 443 | Reverse proxy |
| Web | 80 | 8080 | Dashboard (dev) |
| API | 3000 | 3000 | API endpoints (dev) |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | Cache/Rate limit |
| MinIO | 9000, 9001 | 9000, 9001 | Object storage |

## Production Deployment

### Security Hardening

1. **Change all default passwords** in `.env`
2. **Use strong JWT secret** (32+ characters)
3. **Enable HTTPS** by uncommenting SSL redirect in `nginx.conf`
4. **Close unnecessary ports** - only expose 80 and 443
5. **Set restrictive CORS** in `ALLOWED_ORIGINS`
6. **Enable firewall** rules
7. **Regular security updates**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

### Database Backups

```bash
# Backup database
docker-compose exec postgres pg_dump -U veilforms veilforms > backup-$(date +%Y%m%d).sql

# Restore database
cat backup-20240115.sql | docker-compose exec -T postgres psql -U veilforms veilforms
```

### MinIO Backups

```bash
# Backup MinIO data
docker-compose exec minio mc mirror myminio/veilforms /backup/veilforms

# Restore MinIO data
docker-compose exec minio mc mirror /backup/veilforms myminio/veilforms
```

### Monitoring

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres

# Check health status
docker-compose ps
curl http://localhost/health
```

### Scaling

To scale the API service:

```bash
docker-compose up -d --scale api=3
```

Update `nginx.conf` to add multiple API upstream servers.

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `my-secure-password` |
| `REDIS_PASSWORD` | Redis password | `my-redis-password` |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | `my-minio-password` |
| `JWT_SECRET` | JWT signing secret | `openssl rand -base64 32` |
| `URL` | Base URL | `https://forms.example.com` |
| `ALLOWED_ORIGINS` | CORS origins | `https://example.com` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key | - |
| `RESEND_API_KEY` | Email API key | - |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests/min | `100` |
| `LOG_LEVEL` | Logging level | `info` |

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Restart services
docker-compose restart
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U veilforms -d veilforms -c "SELECT 1;"
```

### MinIO connection errors

```bash
# Check MinIO is running
docker-compose ps minio

# Access MinIO console
open http://localhost:9001

# Recreate bucket
docker-compose restart minio-setup
```

### Port conflicts

```bash
# Find what's using a port
lsof -i :80
lsof -i :3000

# Change ports in docker-compose.yml
# Example: "8080:80" instead of "80:80"
```

## Upgrading

```bash
# Pull latest changes
git pull origin main

# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Run database migrations (if any)
docker-compose exec api npm run migrate
```

## Development

For local development with hot reload:

```bash
# Start only infrastructure services
docker-compose up -d postgres redis minio minio-setup

# Run API locally
cd ../netlify/functions
npm install
npm run dev

# Run Hugo locally
cd ../..
npm run dev
```

## Uninstalling

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Internet                                                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Nginx (80/443) │  SSL Termination
         │  Reverse Proxy  │  Rate Limiting
         └────────┬────────┘  Security Headers
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
  ┌──────────┐      ┌──────────┐
  │   Web    │      │   API    │
  │  (Hugo)  │      │ (Node.js)│
  └──────────┘      └─────┬────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │PostgreSQL│    │  Redis   │    │  MinIO   │
  │(Database)│    │ (Cache)  │    │ (Blobs)  │
  └──────────┘    └──────────┘    └──────────┘
```

## Support

- **Documentation**: https://docs.veilforms.com
- **GitHub Issues**: https://github.com/veilforms/veilforms/issues
- **Self-Hosting Guide**: https://docs.veilforms.com/guides/self-hosting

## License

VeilForms is open source software licensed under the MIT license.
