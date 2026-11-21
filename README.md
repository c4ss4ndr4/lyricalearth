# SHARED FORM — Experimental Geographic Film

An interactive web artwork using Google Maps 3D (`<gmp-map-3d>`) imagery, programmatic SVG vector contours, tactile pointer/touch manipulation, and shape-similarity detection across four linked movements:

1. **I. Shelter and Space** — *Petra — The Siq & Carved Threshold, Jordan* (`30.3221° N, 35.4517° E`)
2. **II. Space and Body** — *Namib Sand Sea — Sossusvlei, Namibia* (`24.7595° S, 15.2915° E`)
3. **III. Body and Yoga** — *Rishikesh — Ganges Bend, India* (`30.1235° N, 78.3168° E`)
4. **IV. Dance and Flow** — *Bazaruto Archipelago, Mozambique* (`21.6500° S, 35.4833° E`)

## Running the Prototype

Because the project uses ES modules (`type="module"`), serve the directory over a local HTTP server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Enabling Live Google Maps 3D Earth Imagery

1. Enable **Maps JavaScript API** in your Google Cloud Console project.
2. Paste your API key into `GOOGLE_MAPS_API_KEY` in `config.js`, or pass it directly in the URL:
   `http://localhost:8080/?key=YOUR_GOOGLE_MAPS_API_KEY`
3. Google's native logo/data attribution and `#attribution-bar` remain visible whenever Google Maps 3D imagery is displayed. When no API key is configured, a legal procedural topographic relief model derived from each location's landform archetype is rendered automatically.

## Customizing Locations, Contours & Thresholds

All tunable parameters are clearly commented in `config.js`:

- **`SCENES`**: Replace coordinates (`lat`, `lng`, `altitude`, `range`, `tilt`, `heading`), `geographyType`, `targetForm`, or `essayLine`.
- **`CONTOUR_CONFIG`**: Adjust `strandsPerScene`, `pointsPerStrand`, `discontinuityRate`, and `aliveAmplitudePx`.
- **`SIMILARITY_CONFIG`**: Adjust `matchThreshold` (`0.78` default), feature weights, and `ghostRevealThreshold`.
- **`TIMING_CONFIG`**: Adjust `sceneSettleDurationMs` (`5000` ms default) and `transitionDurationMs`.
