# GeoMaps Nominatim Quality Enhancement Pipeline

Production implementation of the address cleansing and validation system for Berijalan GeoService.

## Overview

This fullstack application validates OpenStreetMap Nominatim reverse-geocoding results using AI-powered analysis (Gemini) to ensure Indonesian address data quality. The system:

- Performs single and batch coordinate validation
- Compares Nominatim results against expected addresses
- Uses AI to detect errors (wrong road, village, district, hierarchy)
- Stores validation records and correction logs
- Generates quality metrics (accuracy per level, error distribution, confidence scores)

## Tech Stack

- **Framework**: Next.js 16.3.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API (configurable base URL)
- **Storage**: JSON file-based (`.data/records.json`)
- **Icons**: Lucide React

## Features

### 1. Test & Validate
- **Single Coordinate Test**: Input lat/lon and optional expected address
- **Batch Grid Sampling**: Generate grid across Indonesian provinces (38 provinces supported)
- **Random Nationwide Sampling**: Test random coordinates across Indonesia
- **Real-time Comparison**: Side-by-side view of Nominatim vs Expected vs AI Analysis

### 2. Correction Log
- View all validation records
- Filter by status (VALID, NEED_REVIEW, INCORRECT)
- Export verified assets for downstream use

### 3. Quality Dashboard
- Overall accuracy metrics
- Accuracy per administrative level (road, village, district, city, province)
- Error distribution analysis
- Confidence score tracking

## Installation

```bash
# Clone repository
git clone https://github.com/wicahma/rnd-geocoding-validation.git
cd rnd-geocoding-validation

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Gemini API key

# Run development server
npm run dev
```

## Configuration

### Environment Variables

Create `.env.local`:

```env
# Gemini API Configuration (optional - falls back to heuristic validation)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_MODEL=gemini-2.0-flash

# Optional: Custom data directory
DATA_DIR=.data
```

**Note**: If `GEMINI_API_KEY` is not set, the system uses heuristic validation (checks for missing fields, Indonesian territory bounds, expected vs actual comparison).

### Nominatim Usage Policy

This application complies with [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/):
- User-Agent: `RndGeocodingValidation/1.0 (Berijalan Address Cleansing)`
- Rate limiting: 1 request per second (enforced in `batchReverseGeocode`)

## API Routes

### POST `/api/validate`

Single coordinate validation.

**Request**:
```json
{
  "coordinate": { "lat": -6.2146, "lon": 106.8485 },
  "expected": {
    "road": "Jl. Sudirman",
    "village": "Bendungan Hilir",
    "district": "Tanah Abang",
    "city": "Jakarta Pusat",
    "province": "DKI Jakarta",
    "postcode": "10210"
  }
}
```

**Response**: `ValidationRecord` object with Nominatim result, AI validation, and metadata.

### POST `/api/validate/batch`

Batch validation for multiple coordinates.

**Request**:
```json
{
  "coordinates": [
    { "lat": -6.2146, "lon": 106.8485 },
    { "lat": -6.1751, "lon": 106.8650 }
  ]
}
```

**Response**: Array of `ValidationRecord` objects.

### GET `/api/analytics`

Returns quality metrics.

**Response**: `QualityMetrics` object with accuracy per level, error distribution, overall confidence.

### GET `/api/corrections`

Returns validation records.

**Query Parameters**:
- `type=verified` — Return only records with status `VALID`

**Response**: Array of `ValidationRecord` objects.

## Data Types

See `src/types/index.ts` for complete type definitions.

### Key Types

- `Coordinate`: `{ lat: number, lon: number }`
- `NominatimAddress`: Reverse geocoding result from Nominatim
- `ExpectedAddress`: Ground truth address (optional)
- `AIValidationAnalysis`: AI validation result with status, confidence, error types
- `ValidationRecord`: Complete test execution record
- `QualityMetrics`: Aggregated quality metrics

## Indonesian Administrative Hierarchy

The system validates against Indonesia's administrative structure:
- **Provinsi** (Province) → 38 provinces
- **Kabupaten/Kota** (City/Regency)
- **Kecamatan** (District)
- **Kelurahan/Desa** (Village/Sub-district)
- **Jalan** (Road/Street)

## Grid Sampling

The system supports grid-based sampling across Indonesian provinces:

```typescript
import { INDONESIA_PROVINCES, gridSampleInBounds } from "@/lib/sampler";

// Generate 2x2 grid for DKI Jakarta
const coords = gridSampleInBounds(INDONESIA_PROVINCES[10].bounds, 2);
// Returns 4 coordinates evenly distributed across Jakarta
```

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── validate/route.ts       # Single validation endpoint
│   │   ├── validate/batch/route.ts # Batch validation endpoint
│   │   ├── analytics/route.ts      # Quality metrics endpoint
│   │   └── corrections/route.ts    # Correction logs endpoint
│   ├── page.tsx                    # Main dashboard UI
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── lib/
│   ├── nominatim.ts                # Nominatim reverse geocoding service
│   ├── gemini.ts                   # Gemini AI validation service
│   ├── storage.ts                  # JSON file-based storage
│   └── sampler.ts                  # Grid/random coordinate sampling
└── types/
    └── index.ts                    # TypeScript type definitions
```

## License

MIT

## Author

wicahma (Berijalan GeoService)

## References

- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Next.js Documentation](https://nextjs.org/docs)
