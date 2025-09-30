-- Restore der gesicherten Tabellen nach dem DB Reset
-- Dieses Script stellt die Daten nach dem Reset wieder her

-- 1. Restore der organizations Tabelle
INSERT INTO organizations (id, name, slug, created_at, updated_at)
SELECT id, name, slug, created_at, updated_at 
FROM organizations_backup
ON CONFLICT (id) DO NOTHING;

-- 2. Restore der users Tabelle
INSERT INTO users (id, name, email, role, organization_id, auth_id, created_at, updated_at, last_login_at)
SELECT id, name, email, role, organization_id, auth_id, created_at, updated_at, last_login_at
FROM users_backup
ON CONFLICT (id) DO NOTHING;

-- 3. Restore der payment_transactions Tabelle
INSERT INTO payment_transactions (
    id, 
    transaction_id, 
    amount, 
    currency, 
    status, 
    transaction_date, 
    organization_id, 
    merchant_code, 
    created_at, 
    updated_at
)
SELECT 
    id, 
    transaction_id, 
    amount, 
    currency, 
    status, 
    transaction_date, 
    organization_id, 
    merchant_code, 
    created_at, 
    updated_at
FROM payment_transactions_backup
ON CONFLICT (id) DO NOTHING;

-- 4. Restore der merchant_codes Tabelle
INSERT INTO merchant_codes (
    id,
    merchant_code,
    organization_id,
    oauth_access_token_encrypted,
    oauth_refresh_token_encrypted,
    oauth_token_expires_at,
    oauth_client_id,
    oauth_client_secret_encrypted,
    created_at,
    updated_at
)
SELECT 
    id,
    merchant_code,
    organization_id,
    oauth_access_token_encrypted,
    oauth_refresh_token_encrypted,
    oauth_token_expires_at,
    oauth_client_id,
    oauth_client_secret_encrypted,
    created_at,
    updated_at
FROM merchant_codes_backup
ON CONFLICT (id) DO NOTHING;

-- Zeige die Anzahl der wiederhergestellten Datensätze
SELECT 
    'organizations' as table_name, 
    COUNT(*) as restored_count 
FROM organizations
UNION ALL
SELECT 
    'users' as table_name, 
    COUNT(*) as restored_count 
FROM users
UNION ALL
SELECT 
    'payment_transactions' as table_name, 
    COUNT(*) as restored_count 
FROM payment_transactions
UNION ALL
SELECT 
    'merchant_codes' as table_name, 
    COUNT(*) as restored_count 
FROM merchant_codes;

-- Cleanup: Lösche die Backup-Tabellen nach erfolgreicher Wiederherstellung
-- (Kommentiere diese Zeilen aus, wenn du die Backups behalten möchtest)
-- DROP TABLE IF EXISTS organizations_backup;
-- DROP TABLE IF EXISTS users_backup;
-- DROP TABLE IF EXISTS payment_transactions_backup;
-- DROP TABLE IF EXISTS merchant_codes_backup;
