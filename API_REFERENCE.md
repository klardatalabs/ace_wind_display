# ACE Wind Energy Site Data - API Reference

## 1. Overview & Service Metadata

The **ACE Wind Energy Site Data API** provides open, programmatic access to live and historical telemetry, status events, control setpoints, and configuration states from the Ambition Community Energy 4.2 MW wind turbine in Avonmouth/Lawrence Weston, Bristol, UK.

- **Base URL:** `https://ace-api.duckdns.org`
- **API Version:** `0.7.0`
- **OpenAPI Schema:** `https://ace-api.duckdns.org/openapi.json`
- **Interactive Documentation (Swagger):** `https://ace-api.duckdns.org/docs`
- **Human-Readable Index:** `https://ace-api.duckdns.org/index.html`
- **LLM/AI Agent Guidelines:** `https://ace-api.duckdns.org/llms.txt`
- **Protocol:** HTTPS / REST (JSON responses)
- **Licence:** Creative Commons Attribution 4.0 International (CC-BY-4.0)

---

## 2. Authentication & Access Policy

- **Authentication:** **None required**. The API is publicly accessible and read-only.
- **Client Identification:** Clients should include an identifiable, descriptive `User-Agent` string (e.g. `User-Agent: ACE-Community-Display/1.0`).
- **CORS:** Enabled for public web applications.
- **Rate Limiting & Polling Rules:**
  - One-second dashboards (`resolution=1s`) may refresh at most **once per second (1 Hz)**.
  - Historical `range` queries should sequentialize pagination using `next_cursor`; **do not crawl pages in parallel**.
  - When receiving **HTTP 429 Too Many Requests**, clients **must inspect the `Retry-After` header** and apply exponential backoff.

---

## 3. Data Representation, Timestamps & Units

### Timestamps
- **Response Timestamps:** Delivered as **Unix epoch microseconds** integers (e.g. `1790853965095000` = `1790853965.095` seconds UTC).
  ```javascript
  // Javascript conversion
  const date = new Date(timestamp_micro / 1000);
  ```
- **Query Timestamps:** Range endpoints expect ISO-8601 UTC strings:
  - Example: `2026-09-01T00:00:00Z` or `2026-09-01T00:00:00+00:00`
- **Timezone:** All times in the API are natively **UTC**.

### Response Structure (Columnar Format)
Telemetry data is returned in an efficient columnar structure designed for high-frequency time-series:
```json
{
  "site": "ace",
  "asset": "wec-1",
  "family": "wec_instantaneous",
  "resolution": "1s",
  "resolution_seconds": 1,
  "poll_interval_seconds": 1,
  "timestamps": [1790853995038000, 1790853996030000],
  "series": {
    "wec_active_power": [185.0, 183.0],
    "wec_rotor_speed": [6.19, 6.19],
    "wec_wind_speed": [4.4, 4.2]
  },
  "quality": ["good", "good"],
  "fields": [
    {
      "name": "wec_active_power",
      "display_name": "Active power",
      "unit": "kW",
      "description": "Value supplied directly by OPC node {asset_path}/P.",
      "native_name": "{asset_path}/P",
      "native_index": 6
    }
  ],
  "page": {
    "points": 2,
    "has_more": false,
    "next_cursor": null
  },
  "attribution": {
    "dataset": "ACE Wind Turbine Data",
    "license": "CC-BY-4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "citation_doi": "10.5281/zenodo.22662372"
  }
}
```

---

## 4. Endpoints Reference

### 4.1 System & Discovery Endpoints

#### `GET /`
Returns service metadata, version, available sub-resource links, and attribution.

#### `GET /health`
Liveness probe returning `{"status": "ok"}`.

#### `GET /v1/status`
Returns service health, data ingestion freshness, storage consumption, data retention windows, and latest verified Zenodo publication.
- **Example Response fields:**
  - `ingestion.series`: Array of ingestion ages and gap statistics.
  - `database_storage.used_bytes` / `capacity_bytes` / `percent_used`.
  - `retention_days`: `{"1s": 35, "60s": 90, "10m": 366}`.
  - `zenodo.record_doi`: e.g. `10.5281/zenodo.22794387`.

#### `GET /v1/attribution`
Returns full licensing, citation instructions, project URLs, and attribution text.

#### `GET /v1/families`
Returns catalogue of all 14 time-series data families, their resolution capabilities, public access flags, and fields metadata.

#### `GET /v1/event-families`
Returns catalogue of event families (`status`, `setpoint_documentation`) with their field schemas.

---

### 4.2 Hierarchy Endpoints (Sites & Assets)

#### `GET /v1/sites`
Lists public sites. Currently returns:
```json
{
  "sites": [
    { "id": "ace", "display_name": "ACE Wind Energy Site" }
  ]
}
```

#### `GET /v1/sites/{site_id}`
Returns details for the site (use `site_id = "ace"`).

#### `GET /v1/sites/{site_id}/assets`
Lists active assets within the site.
- **Returns:**
  1. `asset_id = "wec-1"`: "ACE Wind Turbine" (`asset_type: "wec"`, `opc_path: "Loc/Wec/Plant1"`)
  2. `asset_id = "controller-2"`: "ACE Site Controller" (`asset_type: "site_controller"`, `opc_path: "Loc/Ctrl/Plant2"`)

#### `GET /v1/sites/{site_id}/assets/{asset_id}`
Returns specific metadata for `wec-1` or `controller-2`.

---

### 4.3 Telemetry Endpoints (Latest & Range)

#### `GET /v1/sites/{site_id}/data/{family_name}/latest`
Fetches the most recent observations for site-scoped families (e.g. `site_instantaneous`).

**Query Parameters:**
- `resolution` (required): `1s` or `60s`
- `fields` (required): Comma-separated field names (e.g. `aggregate_active_power,aggregate_reactive_power`)
- `limit` (optional): Integer (1 to 2000, default based on resolution)

**Example:**
```http
GET /v1/sites/ace/data/site_instantaneous/latest?resolution=1s&fields=aggregate_active_power,aggregate_reactive_power&limit=60
```

---

#### `GET /v1/sites/{site_id}/data/{family_name}/range`
Fetches a historical window of site-scoped telemetry.

**Query Parameters:**
- `resolution` (required): e.g. `60s`, `10m`
- `fields` (required): Comma-separated field names
- `start` (required): ISO-8601 UTC timestamp (inclusive, e.g. `2026-09-01T00:00:00Z`)
- `end` (required): ISO-8601 UTC timestamp (exclusive, e.g. `2026-09-02T00:00:00Z`)
- `cursor` (optional): Cursor token from previous page's `page.next_cursor`
- `page_size` (optional): Integer (1 to 5000)

---

#### `GET /v1/sites/{site_id}/assets/{asset_id}/data/{family_name}/latest`
Fetches the most recent observations for asset-scoped families (`wec_instantaneous`, `wecstd`, `tep3c021`, `tep3c022`, `fcu2ctr1`, `fcu2ctr2`, `wecshad`).

**Query Parameters:**
- `resolution` (required): `1s`, `60s`, `10m`, or `daily` (depending on family capability)
- `fields` (required): Comma-separated field names (e.g. `wec_active_power,wec_wind_speed,wec_rotor_speed`)
- `limit` (optional): Integer (1 to 2000)

**Example:**
```http
GET /v1/sites/ace/assets/wec-1/data/wec_instantaneous/latest?resolution=1s&fields=wec_active_power,wec_rotor_speed,wec_wind_speed&limit=10
```

---

#### `GET /v1/sites/{site_id}/assets/{asset_id}/data/{family_name}/range`
Fetches a historical window of asset-scoped telemetry.

**Query Parameters:**
- `resolution` (required): `60s`, `10m`, `daily`
- `fields` (required): Comma-separated field names
- `start` (required): ISO-8601 UTC timestamp
- `end` (required): ISO-8601 UTC timestamp
- `cursor` (optional): Opaque cursor
- `page_size` (optional): Integer (1 to 5000)

**Example:**
```http
GET /v1/sites/ace/assets/wec-1/data/wecstd/range?resolution=10m&fields=active_power_mean,wind_speed_mean,energy_produced&start=2026-08-01T00:00:00Z&end=2026-08-07T00:00:00Z&page_size=1000
```

---

### 4.4 Status & Event Endpoints

#### `GET /v1/sites/{site_id}/assets/{asset_id}/events/status/latest`
Fetches the latest turbine operational status and error codes for `wec-1`.
- **Query Parameter:** `limit` (1 to 1000, default 100).
- **Returned Event Fields:**
  - `main_status` (int)
  - `substatus` (int)
  - `fault_message_flag` (0 or 1)
  - `warning_message_flag` (0 or 1)
  - `service_flag` (0 or 1)
  - `information` (code int)
  - `additional_information` (code int)

#### `GET /v1/sites/{site_id}/events/setpoint_documentation/latest`
Fetches the most recent control setpoints, grid curtailment requests, and setpoint execution status.

---

### 4.5 Configuration Endpoints

#### `GET /v1/sites/{site_id}/configuration/latest`
Returns current site-level static and semi-static configuration:
- `location_number`: "9547"
- `location_name`: "Avonmouth, Bristol"
- `farm_nominal_power`: 4245.0 kW
- `opc_plant_count`: 2
- `scada_time_zone`: "0" (UTC)
- `scada_daylight_saving`: "True"

#### `GET /v1/sites/{site_id}/assets/{asset_id}/configuration/latest`
- For `wec-1`:
  - `wec_type`: "EP3-CS02"
  - `wec_serial_number`: "1160104"
  - `wec_nominal_power`: 4245.0 kW
  - `wec_availability_start`: "2023-03-29T00:00:00.000+01:00"
- For `controller-2`:
  - `controller_type`: "FCU E2"
  - `controller_serial_number`: "9170822"
  - `controller_setpoint_1` to `3`: 4200.0 kW

---

## 5. Error Behaviour & Codes

All errors return structured JSON with an RFC 7807-style error object and unique tracing `request_id`:

```json
{
  "error": {
    "code": "unknown_fields",
    "message": "One or more fields are unknown or not public.",
    "details": {
      "fields": ["invalid_field_name"]
    }
  },
  "request_id": "d2a93664-4edd-4f83-8bdd-c12f52b2a259"
}
```

### Common HTTP Status Codes
| HTTP Status | Error Code | Cause / Resolution |
| :--- | :--- | :--- |
| **400 Bad Request** | `unknown_fields` / `invalid_resolution` | Field names requested do not exist in the selected family or resolution is unsupported. |
| **403 Forbidden** | `family_not_public` | Requested family or asset is restricted. |
| **404 Not Found** | `resource_not_found` | Invalid `site_id`, `asset_id`, or `family_name`. |
| **422 Unprocessable** | `validation_error` | Missing required parameters or invalid ISO-8601 dates. |
| **429 Too Many Requests** | `rate_limit_exceeded` | Query rate exceeded. Wait for seconds given in `Retry-After` header. |
| **500 / 503** | `internal_error` | Server or upstream database error; retry with exponential backoff. |

---

## 6. Caching & Refresh Recommendations

Capabilities metadata from `GET /v1/families` defines optimal refresh frequencies:

| Resolution | Recommended Refresh | Latest Cache Duration | Range Cache Duration |
| :--- | :--- | :--- | :--- |
| **1s** (Instantaneous) | Every 1.0 s | 1 s | 60 s |
| **60s** (Minute) | Every 10.0 s | 10 s | 300 s |
| **10m** (SCADA) | Every 60.0 s | 60 s | 1,800 s |
| **daily** (Availability/Summary) | Every 3,600 s | 300 s | 86,400 s |
