import { chromium } from 'playwright';
import fs from 'fs';

const DASHBOARD_URL = 'https://my.greenhouse.io/dashboard';
const OUTPUT_JSON = 'company-slugs.json';
const OUTPUT_CSV = 'company-slugs.csv';

// Support environment variables for configuration
const HEADLESS_MODE = process.env.HEADLESS === 'true';
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_URL = process.env.TEST_URL || DASHBOARD_URL;

async function scrapeGreenhouseCompanies() {
  console.log('Starting Greenhouse company scraper...');
  console.log(`Mode: ${HEADLESS_MODE ? 'headless' : 'headful'}`);
  if (TEST_MODE) console.log('TEST MODE: Will not wait for manual login');

  // Launch browser
  const browser = await chromium.launch({
    headless: HEADLESS_MODE,
    slowMo: HEADLESS_MODE ? 0 : 100
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to ${TEST_URL}...`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (!TEST_MODE) {
      console.log('\n==========================================');
      console.log('PLEASE LOG IN MANUALLY');
      console.log('==========================================');
      console.log('Once you are logged in and can see the dashboard,');
      console.log('press ENTER in this terminal to continue...\n');

      // Wait for user to press Enter
      await waitForEnter();

      console.log('Waiting for page to load...');
      await page.waitForTimeout(2000);
    } else {
      console.log('Test mode: Skipping manual login wait');
      await page.waitForTimeout(1000);
    }

    console.log('Analyzing page structure...');

    // Try multiple strategies to find company data
    const companies = await extractCompanyData(page);

    if (companies.length === 0) {
      console.log('\n⚠️  No companies found. Let me save the page HTML for analysis...');
      const html = await page.content();
      fs.writeFileSync('page-debug.html', html);
      console.log('Saved page HTML to page-debug.html');

      // Also take a screenshot
      await page.screenshot({ path: 'page-debug.png', fullPage: true });
      console.log('Saved screenshot to page-debug.png');

      console.log('\nPlease check if you are on the correct page.');
      console.log('The scraper tried to find company elements but could not locate them.');
    } else {
      console.log(`\n✓ Found ${companies.length} companies!`);

      // Save to JSON
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(companies, null, 2));
      console.log(`✓ Saved to ${OUTPUT_JSON}`);

      // Save to CSV
      const csv = convertToCSV(companies);
      fs.writeFileSync(OUTPUT_CSV, csv);
      console.log(`✓ Saved to ${OUTPUT_CSV}`);

      // Display sample
      console.log('\nSample companies:');
      companies.slice(0, 10).forEach((company, idx) => {
        console.log(`  ${idx + 1}. ${company.name || company.slug || company}`);
      });

      if (companies.length > 10) {
        console.log(`  ... and ${companies.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('Error during scraping:', error);
    try {
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('Saved error screenshot to error-screenshot.png');
    } catch (screenshotError) {
      console.error('Could not save screenshot:', screenshotError.message);
    }
  } finally {
    if (!TEST_MODE && !HEADLESS_MODE) {
      console.log('\nPress ENTER to close the browser...');
      await waitForEnter();
    }
    await browser.close();
  }
}

async function extractCompanyData(page) {
  // Strategy 1: Look for links to job-boards.greenhouse.io or boards.greenhouse.io
  const boardLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="greenhouse.io"]'));
    const companies = new Set();

    links.forEach(link => {
      const href = link.href;
      // Match patterns like job-boards.greenhouse.io/company-slug or boards.greenhouse.io/company-slug
      const match = href.match(/(?:job-boards|boards)\.greenhouse\.io\/([^\/\?#]+)/);
      if (match && match[1]) {
        companies.add(match[1]);
      }
    });

    return Array.from(companies);
  });

  if (boardLinks.length > 0) {
    console.log(`Found ${boardLinks.length} company slugs from board links`);
    return boardLinks.map(slug => ({ slug, source: 'board-link' }));
  }

  // Strategy 2: Look for company names in the page
  const companyElements = await page.evaluate(() => {
    const results = [];

    // Look for common selectors that might contain company info
    const selectors = [
      '[data-company]',
      '[data-company-name]',
      '[data-organization]',
      '.company',
      '.company-name',
      '.organization',
      '[class*="company"]',
      '[class*="organization"]'
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent.trim();
          const dataCompany = el.getAttribute('data-company') ||
                            el.getAttribute('data-company-name') ||
                            el.getAttribute('data-organization');

          if (dataCompany) {
            results.push({ name: dataCompany, source: 'data-attribute' });
          } else if (text && text.length > 0 && text.length < 100) {
            results.push({ name: text, source: 'text-content' });
          }
        });
      } catch (e) {
        // Ignore errors for invalid selectors
      }
    });

    return results;
  });

  if (companyElements.length > 0) {
    console.log(`Found ${companyElements.length} companies from page elements`);
    return companyElements;
  }

  // Strategy 3: Look for API calls that might contain company data
  const apiData = await page.evaluate(() => {
    // Check if there's any window data with company info
    const results = [];

    // Common places where data might be stored
    const dataKeys = ['companies', 'organizations', 'employers', 'boards'];

    dataKeys.forEach(key => {
      if (window[key] && Array.isArray(window[key])) {
        window[key].forEach(item => {
          if (typeof item === 'string') {
            results.push({ slug: item, source: 'window-data' });
          } else if (item && (item.name || item.slug)) {
            results.push({
              name: item.name,
              slug: item.slug,
              source: 'window-data'
            });
          }
        });
      }
    });

    return results;
  });

  if (apiData.length > 0) {
    console.log(`Found ${apiData.length} companies from window data`);
    return apiData;
  }

  // Strategy 4: Extract all text and look for patterns
  const textPatterns = await page.evaluate(() => {
    const bodyText = document.body.textContent;
    const companies = [];

    // Look for patterns that might indicate company slugs
    // This is a last resort and might have false positives
    const slugPattern = /([a-z0-9-]+)(?=\s+(?:jobs|positions|openings|careers))/gi;
    const matches = bodyText.match(slugPattern);

    if (matches) {
      return Array.from(new Set(matches.map(m => m.trim().toLowerCase())))
        .filter(m => m.length > 2 && m.length < 50)
        .map(slug => ({ slug, source: 'text-pattern' }));
    }

    return [];
  });

  return textPatterns;
}

function convertToCSV(companies) {
  if (companies.length === 0) return '';

  // Get all unique keys
  const keys = Array.from(new Set(companies.flatMap(c => Object.keys(c))));

  // Create header
  const header = keys.join(',');

  // Create rows
  const rows = companies.map(company => {
    return keys.map(key => {
      const value = company[key] || '';
      // Escape commas and quotes
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

// Run the scraper
scrapeGreenhouseCompanies().catch(console.error);
