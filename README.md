# Greenhouse Company Scraper

A web scraper to extract all company names/slugs from the Greenhouse dashboard at https://my.greenhouse.io/dashboard.

## Features

- **Headful Browser**: Launches a visible browser window for manual login
- **Multiple Extraction Strategies**: Uses various methods to find company data
- **Multiple Output Formats**: Saves results as both JSON and CSV
- **Debug Support**: Saves screenshots and HTML for troubleshooting
- **Interactive**: Waits for user confirmation before proceeding

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browser (Chromium):
```bash
npm run install-browsers
```

## Usage

1. Run the scraper:
```bash
npm run scrape
```

2. A Chrome browser window will open and navigate to the Greenhouse dashboard

3. **Manually log in** to your Greenhouse account in the browser window

4. Once you're logged in and can see the dashboard, return to the terminal and **press ENTER**

5. The scraper will analyze the page and extract all company slugs

6. Results will be saved to:
   - `company-slugs.json` - JSON format with detailed information
   - `company-slugs.csv` - CSV format for easy import into spreadsheets

## Output Format

### JSON Format
```json
[
  {
    "slug": "company-name",
    "name": "Company Name",
    "source": "board-link"
  }
]
```

### CSV Format
```csv
slug,name,source
company-name,Company Name,board-link
```

## Extraction Strategies

The scraper uses multiple strategies to find company data:

1. **Board Links**: Extracts company slugs from links to `job-boards.greenhouse.io/[slug]`
2. **Page Elements**: Looks for elements with company-related classes or data attributes
3. **Window Data**: Checks for company data in JavaScript window objects
4. **Text Patterns**: Fallback pattern matching in page text

## Troubleshooting

If no companies are found:

1. Check `page-debug.html` - Full HTML of the page
2. Check `page-debug.png` - Screenshot of the page
3. Verify you are logged in and on the correct dashboard page
4. The page structure might have changed - you may need to update the selectors

## Debug Files

When the scraper encounters issues, it creates:
- `page-debug.html` - Full page HTML for analysis
- `page-debug.png` - Screenshot of the current page
- `error-screenshot.png` - Screenshot when errors occur

## Notes

- The browser runs in **headful mode** (visible) so you can manually log in
- The scraper waits for your confirmation before proceeding
- All sensitive data is in your local browser session (not stored by this script)
- Company data is publicly accessible on Greenhouse job boards

## License

MIT
