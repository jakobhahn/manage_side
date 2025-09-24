# 🚨 Quick Fix für Production Login

## Problem:
- Login: "Invalid login credentials" 
- Registration: "Invalid token"

## Ursache:
Die Production Supabase-Datenbank hat noch keine Seed-Daten und der Test-User existiert nicht.

## 🚀 Sofortige Lösung:

### Option 1: Seed-Daten einfügen (Empfohlen)
1. **Gehe zu deinem Supabase Dashboard**
2. **SQL Editor öffnen**
3. **Führe `production-seed.sql` aus** (kopiere den Inhalt)
4. **Dann führe `create-test-user.sql` aus** (kopiere den Inhalt)

### Option 2: Neuen User registrieren
1. **Gehe zu deiner Vercel-App**
2. **Klicke "Create one"**
3. **Registriere dich mit:**
   - Restaurant Name: `Test Restaurant`
   - Organization URL: `test-restaurant`
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `testpassword123`

## 🔧 Debugging:

### Wenn Registration immer noch "Invalid token" sagt:
1. **Überprüfe Vercel Environment Variables:**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Überprüfe Supabase Logs:**
   - Gehe zu Supabase Dashboard → Logs
   - Schaue nach Fehlern bei der Registration

### Wenn Login nicht funktioniert:
- Der User existiert nicht in der Auth-Tabelle
- Du musst zuerst die Seed-Daten einfügen

## 📞 Nächste Schritte:
1. **Führe die Seed-Daten aus**
2. **Teste den Login mit jakob@klapp.pizza / adminadmin**
3. **Falls das nicht funktioniert, registriere einen neuen User**

---
**Wichtig:** Die Seed-Daten müssen zuerst in die Production-Datenbank eingefügt werden!
