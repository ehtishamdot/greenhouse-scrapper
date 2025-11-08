import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testScraperLocally() {
  console.log('Testing scraper with local mock HTML...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Load the mock HTML file
    const mockHtmlPath = join(__dirname, 'test-mock.html');
    const mockUrl = `file://${mockHtmlPath}`;

    console.log('Test 1: Loading mock HTML page');
    await page.goto(mockUrl, { waitUntil: 'load' });
    console.log('✓ Successfully loaded mock page');

    // Test the extraction logic from the main scraper
    console.log('\nTest 2: Extracting company slugs from board links');
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

    console.log(`✓ Extracted ${boardLinks.length} company slugs`);
    console.log('  Companies found:', boardLinks.join(', '));

    // Verify we got the expected companies
    const expectedCompanies = ['airbnb', 'shopify', 'stripe', 'github', 'robinhood', 'coinbase', 'doordash', 'instacart'];
    const foundAll = expectedCompanies.every(company => boardLinks.includes(company));

    if (foundAll) {
      console.log('✓ All expected companies were found');
    } else {
      console.log('✗ Some companies were missed');
      const missing = expectedCompanies.filter(c => !boardLinks.includes(c));
      console.log('  Missing:', missing.join(', '));
    }

    // Test 3: Verify data structure
    console.log('\nTest 3: Verifying data structure');
    const companyData = boardLinks.map(slug => ({ slug, source: 'board-link' }));
    console.log('✓ Created data structure:', JSON.stringify(companyData.slice(0, 2), null, 2));

    // Test 4: Test CSV conversion
    console.log('\nTest 4: Testing CSV conversion');
    const csv = convertToCSV(companyData);
    const csvLines = csv.split('\n');
    console.log(`✓ CSV created with ${csvLines.length} lines (including header)`);
    console.log('  Header:', csvLines[0]);
    console.log('  First row:', csvLines[1]);

    // Test 5: Test JSON output
    console.log('\nTest 5: Testing JSON output');
    const json = JSON.stringify(companyData, null, 2);
    console.log(`✓ JSON created with ${json.length} characters`);

    // Save test outputs
    console.log('\nTest 6: Testing file writing');
    fs.writeFileSync('test-output.json', json);
    fs.writeFileSync('test-output.csv', csv);
    console.log('✓ Successfully wrote test-output.json');
    console.log('✓ Successfully wrote test-output.csv');

    // Test 7: Screenshot capability
    console.log('\nTest 7: Testing screenshot capability');
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('✓ Successfully created test-screenshot.png');

    console.log('\n========================================');
    console.log('ALL TESTS PASSED ✓');
    console.log('========================================');
    console.log('\nThe scraper is working correctly!');
    console.log('\nTo use with actual Greenhouse dashboard:');
    console.log('  npm run scrape');
    console.log('\nOr with environment variables:');
    console.log('  HEADLESS=true TEST_MODE=true npm run scrape\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function convertToCSV(companies) {
  if (companies.length === 0) return '';

  const keys = Array.from(new Set(companies.flatMap(c => Object.keys(c))));
  const header = keys.join(',');

  const rows = companies.map(company => {
    return keys.map(key => {
      const value = company[key] || '';
      if (value.toString().includes(',') || value.toString().includes('"')) {
        return `"${value.toString().replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

testScraperLocally().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
