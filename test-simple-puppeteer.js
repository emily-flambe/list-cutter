const puppeteer = require('puppeteer');

async function testSimpleNavigation() {
    console.log('Starting simple Puppeteer test...');
    
    const isCI = process.env.CI === 'true';
    
    const browser = await puppeteer.launch({ 
        headless: isCI ? 'new' : false,           // Use new headless mode in CI
        defaultViewport: { width: 1200, height: 900 },
        slowMo: isCI ? 0 : 500,                   // No delay in CI
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ],
        executablePath: isCI ? '/usr/bin/google-chrome-stable' : undefined
    });
    
    try {
        const page = await browser.newPage();
        
        // Set timeouts for CI
        page.setDefaultTimeout(isCI ? 60000 : 30000);
        
        // Enable logging
        page.on('console', msg => console.log('PAGE:', msg.text()));
        page.on('pageerror', error => console.log('ERROR:', error.message));
        
        console.log('Navigating to Cutty dev site...');
        await page.goto('https://cutty-dev.emilycogsdill.com');
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000)); // Simple wait for page content
        console.log('Page loaded successfully');
        
        // Take screenshot of initial state
        await page.screenshot({ path: 'debug-initial-load.png', fullPage: true });
        
        // Look for sidebar elements
        console.log('Looking for sidebar elements...');
        const sidebarElements = await page.evaluate(() => {
            const elements = [];
            
            // Look for common navigation elements
            const navLinks = document.querySelectorAll('nav a, .sidebar a, [class*="nav"] a, [class*="menu"] a');
            navLinks.forEach(link => {
                elements.push({
                    text: link.textContent.trim(),
                    href: link.href,
                    className: link.className,
                    id: link.id
                });
            });
            
            return elements;
        });
        
        console.log('Found navigation elements:');
        sidebarElements.forEach((el, i) => {
            console.log(`  ${i + 1}. "${el.text}" (class: ${el.className}, id: ${el.id})`);
        });
        
        // Try to find and click the first meaningful navigation element
        if (sidebarElements.length > 0) {
            const firstLink = sidebarElements.find(el => 
                el.text.length > 0 && 
                !el.text.toLowerCase().includes('home') &&
                !el.text.toLowerCase().includes('logo')
            );
            
            if (firstLink) {
                console.log(`Attempting to click: "${firstLink.text}"`);
                
                // Try to click by text content
                try {
                    // Use XPath to find element by text
                    const [element] = await page.$x(`//a[contains(text(), '${firstLink.text}')]`);
                    if (element) {
                        await element.click();
                        console.log('Clicked successfully');
                    } else {
                        throw new Error('Element not found by text');
                    }
                    
                    // Wait a moment for navigation
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Check if URL changed
                    const newUrl = page.url();
                    console.log('New URL:', newUrl);
                    
                    // Take screenshot after click
                    await page.screenshot({ path: 'debug-after-click.png', fullPage: true });
                    
                } catch (clickError) {
                    console.log('Click by text failed, trying by selector...');
                    
                    // Try alternative click methods
                    const selector = firstLink.id ? `#${firstLink.id}` : 
                                   firstLink.className ? `.${firstLink.className.split(' ')[0]}` :
                                   `a[href="${firstLink.href}"]`;
                    
                    console.log('Trying selector:', selector);
                    await page.click(selector);
                    console.log('Alternative click succeeded');
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await page.screenshot({ path: 'debug-after-alt-click.png', fullPage: true });
                }
            } else {
                console.log('No suitable navigation elements found to click');
            }
        } else {
            console.log('No navigation elements found on page');
        }
        
        console.log('Test completed! Check debug-*.png files for screenshots.');
        if (!isCI) {
            console.log('Keeping browser open for 10 seconds for manual inspection...');
        }
        
        // Keep browser open briefly for inspection (only in local dev)
        if (!isCI) {
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        try {
            // Take comprehensive error screenshot
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            await page.screenshot({ 
                path: `debug-error-${timestamp}.png`, 
                fullPage: true 
            });
            
            // Also capture page info for debugging
            const url = page.url();
            const title = await page.title().catch(() => 'Could not get title');
            
            console.log('🐛 Debug Info:');
            console.log(`   URL: ${url}`);
            console.log(`   Title: ${title}`);
            console.log(`   Screenshot: debug-error-${timestamp}.png`);
            
        } catch (screenshotError) {
            console.log('Could not take error screenshot:', screenshotError.message);
        }
    } finally {
        await browser.close();
        console.log('Browser closed. Test finished.');
    }
}

// Run the test
testSimpleNavigation()
    .then(() => {
        console.log('✅ Puppeteer test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Puppeteer test failed:', error);
        process.exit(1);
    });