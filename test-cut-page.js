const puppeteer = require('puppeteer');

async function testCutPage() {
    console.log('🔍 Testing CUT page for Apply Filters button...');
    
    const isCI = process.env.CI === 'true';
    
    const browser = await puppeteer.launch({ 
        headless: isCI ? 'new' : false,
        defaultViewport: { width: 1200, height: 900 },
        slowMo: isCI ? 0 : 1000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security'
        ],
        executablePath: isCI ? '/usr/bin/google-chrome-stable' : undefined
    });
    
    try {
        const page = await browser.newPage();
        
        // Set timeouts
        page.setDefaultTimeout(isCI ? 60000 : 30000);
        
        // Enable logging
        page.on('console', msg => console.log('PAGE:', msg.text()));
        page.on('pageerror', error => console.log('ERROR:', error.message));
        
        console.log('📡 Navigating to CUT page...');
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Take initial screenshot
        await page.screenshot({ path: 'debug-cut-page-initial.png', fullPage: true });
        
        // Look for Apply Filters button
        console.log('🔍 Searching for Apply Filters button...');
        
        const applyFiltersButton = await page.evaluate(() => {
            // Look for button with "Apply Filters" text
            const buttons = Array.from(document.querySelectorAll('button'));
            const applyButton = buttons.find(btn => 
                btn.textContent.includes('Apply Filters') || 
                btn.textContent.includes('Apply filters') ||
                btn.textContent.includes('apply filters')
            );
            
            if (applyButton) {
                return {
                    text: applyButton.textContent,
                    visible: applyButton.offsetParent !== null,
                    disabled: applyButton.disabled,
                    className: applyButton.className
                };
            }
            return null;
        });
        
        if (applyFiltersButton) {
            console.log('✅ Found Apply Filters button:', applyFiltersButton);
        } else {
            console.log('❌ Apply Filters button NOT found');
        }
        
        // Check if there are any filters present
        const filterInfo = await page.evaluate(() => {
            // Look for filter-related elements
            const filterElements = Array.from(document.querySelectorAll('[class*="filter"], [class*="Filter"]'));
            const addFilterButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
                btn.textContent.includes('Add Filter') || 
                btn.textContent.includes('filter')
            );
            
            return {
                filterElements: filterElements.length,
                filterElementsInfo: filterElements.slice(0, 3).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    text: el.textContent.substring(0, 100)
                })),
                addFilterButtons: addFilterButtons.map(btn => btn.textContent)
            };
        });
        
        console.log('🔍 Filter-related elements found:', filterInfo);
        
        // Get page structure info
        const pageStructure = await page.evaluate(() => {
            const mainContent = document.querySelector('main') || document.body;
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent);
            const buttons = Array.from(document.querySelectorAll('button')).map(btn => btn.textContent.trim());
            
            return {
                title: document.title,
                headings,
                buttons,
                hasFilters: buttons.some(btn => btn.toLowerCase().includes('filter'))
            };
        });
        
        console.log('📄 Page structure:', pageStructure);
        
        // Try to add a filter to see if Apply Filters button appears
        console.log('🧪 Attempting to add a filter...');
        
        const addFilterResult = await page.evaluate(() => {
            const addFilterBtn = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent.includes('Add Filter') || 
                btn.textContent.includes('Add filter')
            );
            
            if (addFilterBtn && !addFilterBtn.disabled) {
                addFilterBtn.click();
                return 'Clicked Add Filter button';
            }
            
            return 'No Add Filter button found or it was disabled';
        });
        
        console.log('🧪 Add filter result:', addFilterResult);
        
        // Wait a moment and check again for Apply Filters button
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const applyFiltersAfterAdd = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const applyButton = buttons.find(btn => 
                btn.textContent.includes('Apply Filters') || 
                btn.textContent.includes('Apply filters')
            );
            
            return applyButton ? {
                text: applyButton.textContent,
                visible: applyButton.offsetParent !== null,
                disabled: applyButton.disabled
            } : null;
        });
        
        if (applyFiltersAfterAdd) {
            console.log('✅ Apply Filters button found after adding filter:', applyFiltersAfterAdd);
        } else {
            console.log('❌ Still no Apply Filters button after attempting to add filter');
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'debug-cut-page-final.png', fullPage: true });
        
        console.log('📸 Screenshots saved: debug-cut-page-initial.png and debug-cut-page-final.png');
        
        if (!isCI) {
            console.log('🔍 Keeping browser open for manual inspection...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        try {
            await page.screenshot({ path: 'debug-cut-error.png', fullPage: true });
        } catch (screenshotError) {
            console.log('Could not take error screenshot:', screenshotError.message);
        }
    } finally {
        await browser.close();
        console.log('✅ Test completed.');
    }
}

// Run the test
testCutPage()
    .then(() => {
        console.log('✅ CUT page test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ CUT page test failed:', error);
        process.exit(1);
    });