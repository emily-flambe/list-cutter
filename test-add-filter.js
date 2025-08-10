const puppeteer = require('puppeteer');

async function testAddFilter() {
    console.log('🔍 Testing Add Filter functionality...');
    
    const browser = await puppeteer.launch({ 
        headless: false,  // Always show browser for this test
        defaultViewport: { width: 1400, height: 1000 },
        slowMo: 1500,  // Slow it down to see what's happening
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    });
    
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        
        // Enable logging
        page.on('console', msg => console.log('PAGE:', msg.text()));
        page.on('pageerror', error => console.log('ERROR:', error.message));
        
        console.log('📡 Navigating to CUT page...');
        await page.goto('https://cutty-dev.emilycogsdill.com/do-stuff/cut');
        
        // Wait for page to load completely
        console.log('⏳ Waiting for columns to load...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Take initial screenshot
        await page.screenshot({ path: 'debug-add-filter-1-initial.png', fullPage: true });
        
        console.log('🔍 Looking for Add Filter icons (+) in the column list...');
        
        // Look for all Add icons (+ buttons)
        const addIcons = await page.evaluate(() => {
            // Look for SVG icons that might be + symbols
            const icons = Array.from(document.querySelectorAll('svg, button'));
            const addButtons = [];
            
            icons.forEach((element, index) => {
                const text = element.textContent || '';
                const ariaLabel = element.getAttribute('aria-label') || '';
                const title = element.getAttribute('title') || '';
                const className = element.className || '';
                const parentText = element.parentElement?.textContent || '';
                
                // Look for + symbols, Add text, or Material-UI Add icons
                if (
                    text.includes('+') || 
                    text.includes('add') ||
                    ariaLabel.toLowerCase().includes('add') ||
                    title.toLowerCase().includes('add') ||
                    className.includes('Add') ||
                    parentText.includes('+') ||
                    element.querySelector('path[d*="M12 2C6.48"]') ||  // Material-UI Add icon path
                    element.innerHTML.includes('add')
                ) {
                    const rect = element.getBoundingClientRect();
                    addButtons.push({
                        index,
                        tagName: element.tagName,
                        text: text.substring(0, 50),
                        className: className.substring(0, 100),
                        ariaLabel,
                        title,
                        visible: rect.width > 0 && rect.height > 0,
                        position: { x: rect.left + rect.width/2, y: rect.top + rect.height/2 },
                        parentText: parentText.substring(0, 100)
                    });
                }
            });
            
            return addButtons;
        });
        
        console.log(`🔍 Found ${addIcons.length} potential Add Filter buttons:`);
        addIcons.forEach((icon, i) => {
            console.log(`  ${i + 1}. ${icon.tagName} - "${icon.text}" (${icon.visible ? 'visible' : 'hidden'}) at ${icon.position.x},${icon.position.y}`);
            console.log(`      Class: ${icon.className}`);
            console.log(`      Parent: ${icon.parentText}`);
        });
        
        if (addIcons.length > 0) {
            // Try to click the first visible Add button
            const visibleButton = addIcons.find(btn => btn.visible);
            if (visibleButton) {
                console.log(`🎯 Attempting to click Add button at position ${visibleButton.position.x}, ${visibleButton.position.y}`);
                
                // Click at the button's position
                await page.mouse.click(visibleButton.position.x, visibleButton.position.y);
                
                console.log('✅ Clicked on Add button!');
                
                // Wait for UI to update
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Take screenshot after clicking
                await page.screenshot({ path: 'debug-add-filter-2-after-click.png', fullPage: true });
                
                // Now look for Apply Filters button
                const applyButton = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => 
                        btn.textContent.includes('Apply Filters') || 
                        btn.textContent.includes('Apply filters')
                    ) ? 'FOUND' : 'NOT FOUND';
                });
                
                console.log(`🎯 Apply Filters button: ${applyButton}`);
                
                // Check the filter count
                const filterCount = await page.evaluate(() => {
                    const activeFiltersText = document.body.textContent;
                    const match = activeFiltersText.match(/Active Filters \((\d+)\)/);
                    return match ? parseInt(match[1]) : 0;
                });
                
                console.log(`📊 Active filter count: ${filterCount}`);
                
                // Wait longer to see the results
                console.log('🔍 Keeping browser open for manual inspection...');
                await new Promise(resolve => setTimeout(resolve, 30000));
                
            } else {
                console.log('❌ No visible Add buttons found');
            }
        } else {
            console.log('❌ No Add Filter buttons found at all');
            
            // Let's look at what's actually on the page
            const pageContent = await page.evaluate(() => {
                return {
                    html: document.body.innerHTML.substring(0, 2000),
                    allButtons: Array.from(document.querySelectorAll('button')).map(btn => ({
                        text: btn.textContent.trim().substring(0, 50),
                        className: btn.className.substring(0, 100),
                        visible: btn.offsetParent !== null
                    }))
                };
            });
            
            console.log('📄 Page buttons:', pageContent.allButtons);
            
            // Keep browser open for manual inspection
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'debug-add-filter-error.png', fullPage: true });
    } finally {
        await browser.close();
        console.log('✅ Test completed.');
    }
}

testAddFilter();