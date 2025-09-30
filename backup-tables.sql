-- Backup der wichtigsten Tabellen vor dem DB Reset
-- Dieses Script sichert die Daten und kann nach dem Reset wieder ausgeführt werden

-- 1. Backup der organizations Tabelle
CREATE TABLE IF NOT EXISTS organizations_backup AS 
SELECT * FROM organizations;

-- 2. Backup der users Tabelle  
CREATE TABLE IF NOT EXISTS users_backup AS
SELECT * FROM users;

-- 3. Backup der payment_transactions Tabelle
CREATE TABLE IF NOT EXISTS payment_transactions_backup AS
SELECT * FROM payment_transactions;

-- 4. Backup der merchant_codes Tabelle
CREATE TABLE IF NOT EXISTS merchant_codes_backup AS
SELECT * FROM merchant_codes;

-- Zeige die Anzahl der gesicherten Datensätze
SELECT 
    'organizations' as table_name, 
    COUNT(*) as record_count 
FROM organizations_backup
UNION ALL
SELECT 
    'users' as table_name, 
    COUNT(*) as record_count 
FROM users_backup
UNION ALL
SELECT 
    'payment_transactions' as table_name, 
    COUNT(*) as record_count 
FROM payment_transactions_backup
UNION ALL
SELECT 
    'merchant_codes' as table_name, 
    COUNT(*) as record_count 
FROM merchant_codes_backup;
