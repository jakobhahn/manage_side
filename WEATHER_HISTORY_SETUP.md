# Weather History System

## 📊 Übersicht

Das Weather History System speichert jeden abgerufenen Wetterdatenpunkt mit Standort und Zeitpunkt, um eine wertvolle historische Datengrundlage aufzubauen.

## 🗄️ Datenbankschema

### `weather_history` Tabelle

```sql
- id: UUID (Primary Key)
- organization_id: UUID (Foreign Key zu organizations)
- location_address: TEXT (Adresse für Geocoding)
- latitude/longitude: DECIMAL (Genaue Koordinaten)
- recorded_at: TIMESTAMP (Wann das Wetter tatsächlich war)
- date/hour: DATE/INTEGER (Für einfache Abfragen)
- temperature, precipitation, weather_code, wind_speed, humidity, pressure
- data_source: VARCHAR (z.B. 'open-meteo')
- sync_timestamp: TIMESTAMP (Wann die Daten abgerufen wurden)
```

## 🔧 Migration ausführen

### Option 1: Supabase Dashboard
```sql
-- Führe den Inhalt von 010_weather_history_table.sql aus
```

### Option 2: Supabase CLI
```bash
supabase db push
```

## 🚀 Funktionsweise

### 1. Automatische Historische Datenspeicherung
- **Bei jedem Weather-Sync** werden vergangene Datenpunkte als historisch gespeichert
- **Nur tatsächlich vergangene Daten** (keine Forecasts) werden als Historie gespeichert
- **Standort wird mit jedem Datenpunkt** verknüpft
- **Duplikate werden vermieden** durch unique constraint

### 2. Intelligente Filterung
```javascript
// Nur vergangene Daten werden als historisch gespeichert
const historicalWeatherData = weatherData.filter(w => {
  const dataDateTime = new Date(`${w.date}T${w.hour}:00:00`)
  return dataDateTime <= now  // Nur Vergangenheit
})
```

### 3. Standort-Tracking
- **Jeder Datenpunkt** enthält die verwendete Adresse und Koordinaten
- **Organisationsspezifisch**: Jede Organisation hat ihre eigene Historie
- **Adressänderungen** werden automatisch getrackt

## 📈 API Endpunkte

### `/api/weather/history` (GET)

**Query Parameter:**
```
?startDate=2024-01-01          # Startdatum
&endDate=2024-12-31            # Enddatum  
&location=Hamburg              # Standortfilter
&limit=1000                    # Maximale Anzahl
&groupBy=day|week|month        # Gruppierung
```

**Beispiel Response:**
```json
{
  "success": true,
  "data": [
    {
      "recorded_at": "2024-10-02T14:00:00Z",
      "location_address": "Hamburg, Germany",
      "latitude": 53.55073,
      "longitude": 9.99302,
      "temperature": 18.5,
      "precipitation": 0.2,
      "weather_code": 3,
      "data_source": "open-meteo"
    }
  ],
  "stats": {
    "total_records": 1500,
    "date_range": {
      "earliest": "2024-09-01T00:00:00Z",
      "latest": "2024-10-02T14:00:00Z"
    },
    "locations": ["Hamburg, Germany"],
    "data_sources": ["open-meteo"]
  }
}
```

## 💡 Verwendungsmöglichkeiten

### 1. Langzeit-Wetteranalysen
```javascript
// Durchschnittstemperatur der letzten 6 Monate
const response = await fetch('/api/weather/history?startDate=2024-04-01&groupBy=month')
```

### 2. Standortvergleiche
```javascript
// Wetterdaten für verschiedene Standorte vergleichen
const hamburgData = await fetch('/api/weather/history?location=Hamburg')
const berlinData = await fetch('/api/weather/history?location=Berlin')
```

### 3. Saisonale Muster
```javascript
// Wettermuster nach Wochentagen
const weeklyData = await fetch('/api/weather/history?groupBy=week')
```

### 4. Forecasting-Verbesserung
- **Historische Daten** als Basis für bessere Vorhersagen
- **Lokale Wettermuster** erkennen und nutzen
- **Saisonale Trends** in die Umsatzprognose einbeziehen

## 🔍 Monitoring

### Logs überwachen:
```
📊 Successfully saved X historical weather data points for organization Y
```

### Datenqualität prüfen:
```sql
SELECT 
  COUNT(*) as total_records,
  MIN(recorded_at) as earliest_data,
  MAX(recorded_at) as latest_data,
  COUNT(DISTINCT location_address) as unique_locations
FROM weather_history 
WHERE organization_id = 'your-org-id';
```

## ⚡ Performance

- **Indiziert** für schnelle Abfragen nach Datum, Standort und Organisation
- **Partitionierung** nach Datum für große Datenmengen
- **Automatische Duplikatsvermeidung** durch unique constraints
- **RLS-Policies** für Datensicherheit

## 🎯 Nächste Schritte

1. **Migration ausführen** ✅ (bereits erledigt)
2. **Weather-Sync testen** (historische Daten werden automatisch gespeichert)
3. **API testen** mit `/api/weather/history`
4. **Langzeit-Datensammlung** starten
5. **Analytics erweitern** um historische Wetterdaten
6. **Forecast-Detailansicht nutzen** - Klicke auf Tage in der Prognose für stündliche Wetterdaten

## 🎯 Neue Features

### Forecast-Detailansicht
- **Klick auf Prognosetag**: Öffnet Modal mit stündlichen Wetterdaten
- **Stündliche Details**: Temperatur, Niederschlag, Wind, Luftfeuchtigkeit, Druck
- **Temperaturverlauf**: Visueller Chart für den ganzen Tag
- **Wettericons**: Intuitive Darstellung der Wetterbedingungen
