# Vercel Deployment Setup

Diese Anleitung erklärt, wie du automatische Supabase-Migrationen bei Vercel-Deployments einrichtest.

## 🔧 Vercel Environment Variables

Du musst folgende Environment Variables in deinem Vercel-Projekt konfigurieren:

### Supabase Configuration
```bash
SUPABASE_PROJECT_REF=your-project-ref-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
SUPABASE_DB_PASSWORD=your-database-password-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## 📋 Setup-Schritte

### 1. Supabase Access Token erstellen
1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Klicke auf dein Profil → "Access Tokens"
3. Erstelle einen neuen Token mit "All" Permissions
4. Kopiere den Token für `SUPABASE_ACCESS_TOKEN`

### 2. Projekt-Referenz finden
1. Gehe zu deinem Supabase-Projekt
2. Settings → General
3. Kopiere die "Reference ID" für `SUPABASE_PROJECT_REF`

### 3. Database Password
- Verwende das Passwort, das du bei der Projekt-Erstellung gesetzt hast
- Oder setze ein neues unter Settings → Database

### 4. Vercel Environment Variables setzen
1. Gehe zu deinem Vercel-Projekt
2. Settings → Environment Variables
3. Füge alle oben genannten Variables hinzu
4. Stelle sicher, dass sie für "Production" aktiviert sind

## 🚀 Deployment-Prozess

Wenn du auf `main` pushst, passiert automatisch folgendes:

1. **Migration Check**: Script prüft ob es ein Production-Deployment ist
2. **Supabase CLI Installation**: Falls nicht vorhanden
3. **Database Migration**: Führt `supabase db push` aus
4. **Application Build**: Baut die Next.js-App
5. **Deployment**: Vercel deployed die fertige App

## 🔍 Troubleshooting

### Migration Fehler
- Prüfe ob alle Environment Variables korrekt gesetzt sind
- Stelle sicher, dass der Access Token die richtigen Permissions hat
- Überprüfe die Database-Verbindung

### Build Fehler
- Schaue in die Vercel Build-Logs
- Prüfe ob das Script ausführbar ist (`chmod +x scripts/migrate-and-build.sh`)

## 📁 Dateien

- `scripts/migrate-and-build.sh` - Hauptscript für Migration + Build
- `vercel.json` - Vercel-Konfiguration
- `supabase/migrations/` - Alle Datenbankmigrationen

## ⚠️ Wichtige Hinweise

- Migrationen laufen nur bei Production-Deployments
- Teste Migrationen immer erst lokal: `npm run migrate`
- Backup deine Datenbank vor größeren Änderungen
- Preview-Deployments führen keine Migrationen aus

