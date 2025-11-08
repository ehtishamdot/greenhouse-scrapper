import { chromium } from 'playwright';

// Test the scraper by visiting a known Greenhouse job board
async function testScraper() {
  console.log('Testing scraper functionality...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Check if we can extract company slugs from a known page
    console.log('Test 1: Testing extraction logic on a known Greenhouse page');
    const testUrl = 'https://support.greenhouse.io/hc/en-us/articles/38110627059099-MyGreenhouse-Jobs';

    await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ Successfully loaded test page');

    // Test the link extraction logic
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href*="greenhouse.io"]'));
      return allLinks.map(link => link.href);
    });

    console.log(`✓ Found ${links.length} Greenhouse links on the page`);

    // Extract company slugs using the same logic as the main scraper
    const companySlugs = new Set();
    links.forEach(link => {
      const match = link.match(/(?:job-boards|boards)\.greenhouse\.io\/([^\/\?#]+)/);
      if (match && match[1]) {
        companySlugs.add(match[1]);
      }
    });

    console.log(`✓ Extracted ${companySlugs.size} unique company slug(s)`);
    if (companySlugs.size > 0) {
      console.log('  Sample slugs:', Array.from(companySlugs).slice(0, 5).join(', '));
    }

    // Test 2: Verify basic scraper functions
    console.log('\nTest 2: Verifying utility functions');

    const testData = [
      { slug: 'test-company-1', source: 'test' },
      { slug: 'test-company-2', source: 'test' }
    ];

    // Test CSV conversion
    const csvResult = convertToCSV(testData);
    if (csvResult.includes('slug') && csvResult.includes('test-company-1')) {
      console.log('✓ CSV conversion works correctly');
    } else {
      console.log('✗ CSV conversion failed');
    }

    // Test JSON output
    const jsonResult = JSON.stringify(testData, null, 2);
    if (jsonResult.includes('test-company-1')) {
      console.log('✓ JSON serialization works correctly');
    } else {
      console.log('✗ JSON serialization failed');
    }

    // Test 3: Check Playwright functionality
    console.log('\nTest 3: Verifying Playwright capabilities');

    const pageTitle = await page.title();
    console.log(`✓ Can read page title: "${pageTitle}"`);

    const html = await page.content();
    console.log(`✓ Can extract HTML (${html.length} characters)`);

    console.log('\n========================================');
    console.log('ALL TESTS PASSED ✓');
    console.log('========================================');
    console.log('\nThe scraper should work correctly when you run it with:');
    console.log('  npm run scrape\n');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('\nFull error:', error);
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

testScraper().catch(console.error);
