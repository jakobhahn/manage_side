# Rezept-Validierung Modul

## Übersicht

Das Rezept-Validierungsmodul ermöglicht es, Physiotherapie-Heilmittelverordnungen (GKV Muster 13) hochzuladen und automatisch auf formale Plausibilität zu prüfen.

## Features

- **Bild-Upload**: Unterstützt JPG, PNG und PDF (erste Seite)
- **Barcode-Erkennung**: Automatische Erkennung und Dekodierung von DataMatrix-Barcodes
- **OCR-Fallback**: Text-Erkennung falls kein Barcode vorhanden
- **3-Phasen-Validierung**: 
  - **PRE**: Vor der Behandlung (Pflichtfelder, Konsistenz)
  - **DURING**: Während der Behandlung (Frequenz, Termine)
  - **POST**: Nach der Behandlung (Abrechnungsreife)
- **Überschneidungsprüfung**: Erkennt zeitliche Überschneidungen mit anderen Verordnungen

## Installation

1. Migration ausführen:
```bash
supabase db push
```

2. Dependencies installieren:
```bash
pnpm install
```

3. Modul aktivieren:
- Als Super-Admin: Organisation → Module → "Rezept-Validierung" aktivieren
- Oder direkt in der Datenbank: `module_subscriptions` Tabelle

## Verwendung

1. Navigieren Sie zu Dashboard → "Rezept prüfen"
2. Laden Sie ein Bild der Verordnung hoch
3. Das System prüft automatisch:
   - Barcode-Erkennung (falls vorhanden)
   - OCR-Extraktion (Fallback)
   - Validierung aller Felder
4. Ergebnis wird angezeigt mit:
   - Status (OK/WARN/FEHLER)
   - Extrahierte Daten
   - Detaillierte Prüfergebnisse nach Phasen

## Technische Details

### Datenbank

- **Tabelle**: `prescriptions`
- **Modul**: `prescription_validation` (in `module_name` ENUM)

### API

- **Endpoint**: `POST /api/prescriptions/validate`
- **Request**: Multipart form-data mit `file` (und optional `patientId`)
- **Response**: `ValidationResult` mit Status, Daten und Checks

### Services

- **Barcode-Decoder**: `src/lib/prescription/barcode-decoder.ts`
  - Placeholder für Barcode-Erkennung
  - TODO: Implementierung mit zxing-wasm oder ähnlicher Library

- **OCR-Extraktor**: `src/lib/prescription/ocr-extractor.ts`
  - Placeholder für OCR
  - TODO: Implementierung mit Tesseract.js oder Cloud-Service

- **Validator**: `src/lib/prescription/validator.ts`
  - Vollständige 3-Phasen-Validierung
  - Überschneidungsprüfung
  - Abrechnungsreife-Prüfung

## TODO / Erweiterungen

1. **Barcode-Erkennung**: 
   - Implementierung mit zxing-wasm oder Server-Side Library
   - DataMatrix-Parser für Muster 13 Format

2. **OCR**:
   - Integration von Tesseract.js oder Cloud-Service
   - Verbesserte Feld-Erkennung mit Layout-Analyse

3. **PDF-Support**:
   - Konvertierung erster PDF-Seite zu Bild

4. **Tests**:
   - Unit-Tests für Validator
   - Integration-Tests für API
   - E2E-Tests für UI

## Validierungsregeln

### Pflichtfelder (FEHLER wenn fehlt):
- Ausstellungsdatum
- ICD-10 Code
- Diagnosegruppe
- Vorrangiges Heilmittel
- Anzahl Behandlungseinheiten (> 0)
- Therapiefrequenz

### Konsistenz-Checks (WARN):
- Frequenz-Format
- Ungewöhnlich hohe Einheitenzahl (> 24)
- Mehrere ergänzende Heilmittel
- Frist-Überschreitung (> 28 Tage)

### Während der Behandlung:
- Frequenz-Abweichungen
- Überschreitung der Verordnungsmenge
- Lange Pausen zwischen Terminen

### Nach der Behandlung:
- Vollständigkeit für Abrechnung
- Termin-Validierung

## Architektur

Das Modul folgt den bestehenden Patterns:
- Next.js API Routes für Backend
- Supabase für Datenbank
- TypeScript für Type-Safety
- React für UI
- Module-basierte Aktivierung


