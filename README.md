# Enterprise Authentication & Authorization Microservice

A comprehensive, enterprise-grade Authentication and Authorization microservice built with NestJS, TypeScript, PostgreSQL, and Redis. This service provides secure user management, role-based access control (RBAC), multi-factor authentication (MFA), social login integration, and comprehensive audit logging.

## 🚀 Features

### Core Authentication
- **User Registration & Login** - Secure email/password authentication
- **JWT Token Management** - Access tokens with refresh token rotation
- **Email Verification** - Secure email verification flow
- **Password Reset** - Secure password reset with time-limited tokens
- **Account Security** - Account lockout, rate limiting, and suspicious activity detection

### Multi-Factor Authentication (MFA)
- **TOTP Support** - Time-based One-Time Password with QR code generation
- **Backup Codes** - Secure backup codes for account recovery
- **Authenticator Apps** - Compatible with Google Authenticator, Authy, etc.

### Social Authentication
- **OAuth2 Integration** - Google, GitHub, LinkedIn social login
- **Account Linking** - Link multiple social accounts to one user
- **Profile Sync** - Automatic profile information synchronization

### Role-Based Access Control (RBAC)
- **Hierarchical Roles** - Flexible role management system
- **Granular Permissions** - Resource:action based permissions
- **Dynamic Authorization** - Runtime permission checking
- **Custom Decorators** - Easy permission enforcement in controllers

### Security Features
- **Rate Limiting** - Configurable rate limits for different endpoints
- **IP Management** - IP blocking and monitoring
- **Audit Logging** - Comprehensive security event logging
- **Session Management** - Multi-device session tracking and management
- **Security Headers** - Helmet.js integration for security headers

### Admin Features
- **User Management** - Complete user administration
- **Role & Permission Management** - Dynamic role and permission management
- **Analytics Dashboard** - Login statistics and security metrics
- **Audit Logs** - Detailed security event monitoring

## 🏗️ Architecture

### Tech Stack
- **Framework:** NestJS with TypeScript
- **Database:** PostgreSQL with TypeORM
- **Cache/Session Store:** Redis
- **Authentication:** Passport.js with JWT
- **Security:** bcrypt, helmet, rate limiting
- **Documentation:** Swagger/OpenAPI
- **Containerization:** Docker & Docker Compose

### Database Schema
```sql
-- Core entities
users (id, email, password_hash, first_name, last_name, is_verified, is_active, ...)
roles (id, name, description, is_system_role, created_at)
permissions (id, resource, action, description, created_at)
role_permissions (role_id, permission_id)
user_roles (user_id, role_id)

-- Authentication & Security
refresh_tokens (id, user_id, token_hash, expires_at, device_info, ip_address)
auth_events (id, user_id, event_type, ip_address, user_agent, success, created_at)
login_attempts (id, identifier, attempts, blocked_until, created_at)

-- MFA & Social Auth
user_mfa (id, user_id, type, secret, backup_codes, is_enabled)
social_accounts (id, user_id, provider, provider_id, access_token, profile_data)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 15+ (if running locally)
- Redis 7+ (if running locally)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd enterprise-auth-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start with Docker Compose (Recommended)**
```bash
docker-compose up -d
```

5. **Or run locally**
```bash
# Start PostgreSQL and Redis
npm run start:dev
```

6. **Access the application**
- API: http://localhost:3000/api/v1
- Documentation: http://localhost:3000/api/docs
- Health Check: http://localhost:3000/api/v1/health
