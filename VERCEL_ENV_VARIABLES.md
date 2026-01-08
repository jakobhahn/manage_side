# Vercel Environment Variables

Alle Environment Variables, die du in Vercel anlegen musst:

## 🔴 Erforderlich für die App

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Encryption Configuration
```
ENCRYPTION_KEY=your-32-character-encryption-key-here
```
⚠️ Muss genau 32 Zeichen lang sein (generiere mit: `openssl rand -hex 16`)

### N8N Integration
```
N8N_SHARED_SECRET=your-shared-secret-for-n8n
```
⚠️ Muss mit dem N8N_SHARED_SECRET in deiner n8n-Instanz übereinstimmen

## 🟡 Optional (aber empfohlen)

### SumUp Integration
```
SUMUP_WEBHOOK_SECRET=your-sumup-webhook-secret
SUMUP_CLIENT_ID=your-sumup-client-id
SUMUP_CLIENT_SECRET=your-sumup-client-secret
```

### Application Configuration
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

## 🔵 Erforderlich für Supabase Migrationen (Build-Script)

Diese werden nur während des Builds für Datenbank-Migrationen verwendet:

```
SUPABASE_PROJECT_REF=your-project-ref-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
SUPABASE_DB_PASSWORD=your-database-password-here
```

## 📋 Vollständige Liste zum Kopieren

Füge diese in Vercel → Settings → Environment Variables ein:

```bash
# Supabase (App)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Migrationen)
SUPABASE_PROJECT_REF=your-project-ref-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
SUPABASE_DB_PASSWORD=your-database-password-here

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# N8N
N8N_SHARED_SECRET=your-shared-secret-for-n8n

# SumUp (Optional)
SUMUP_WEBHOOK_SECRET=your-sumup-webhook-secret
SUMUP_CLIENT_ID=your-sumup-client-id
SUMUP_CLIENT_SECRET=your-sumup-client-secret

# App Config (Optional)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

## 🔍 Wo findest du die Werte?

### Supabase
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase Dashboard → Settings → API → Project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase Dashboard → Settings → API → Project API keys → anon/public
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → Project API keys → service_role
- **SUPABASE_PROJECT_REF**: Supabase Dashboard → Settings → General → Reference ID
- **SUPABASE_ACCESS_TOKEN**: Supabase Dashboard → Account → Access Tokens (neu erstellen)
- **SUPABASE_DB_PASSWORD**: Das Passwort, das du bei der Projekt-Erstellung gesetzt hast

### Encryption Key
Generiere einen neuen Key:
```bash
openssl rand -hex 16
```

### N8N Shared Secret
Muss mit deiner n8n-Instanz übereinstimmen. Generiere einen neuen:
```bash
openssl rand -base64 32
```

### SumUp
- **SUMUP_WEBHOOK_SECRET**: SumUp Dashboard → Settings → API → Webhook settings
- **SUMUP_CLIENT_ID** & **SUMUP_CLIENT_SECRET**: SumUp Developer Dashboard → OAuth Applications

## ⚠️ Wichtig

1. Stelle sicher, dass alle Variablen für **Production** aktiviert sind
2. Für Preview/Development kannst du die gleichen Werte verwenden oder separate setzen
3. **NICHT** als Secrets anlegen - als normale Environment Variables!
4. Nach dem Setzen: Neues Deployment triggern
