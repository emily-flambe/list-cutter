# Simple Implementation Plan

- [ ] 1. Create backend API
  - Add route: `POST /api/v1/synthetic-data/generate`
  - Generate CSV data with random voter info
  - Save file to R2/D1 like existing files

- [ ] 2. Add frontend page
  - Route: `/synthetic-data`
  - Simple form: count input, state dropdown, generate button
  - Download generated file

- [ ] 3. Add sidebar navigation
  - Add "Generate Data" link to sidebar
  - Point to `/synthetic-data` route

- [ ] 4. Basic testing
  - Test API endpoint works
  - Test frontend form works
  - Test file gets saved properly