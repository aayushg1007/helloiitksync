let isSyncing = false;

// Sends a status update message to the popup, if it's open.
function sendStatusUpdate(message) {
    console.log(message); // Keep for debugging in the service worker console
    chrome.runtime.sendMessage({ action: 'updateStatus', message: message })
        .catch(e => { /* Popup is not open, ignore */ });
}

// Listens for messages from the popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'syncAllCourses') {
        if (!isSyncing) { // Prevent multiple syncs from running
            syncAllCourses();
        }
    } else if (message.action === 'stopSync') {
        if (isSyncing) {
            isSyncing = false; // Set flag to stop the sync loop
            sendStatusUpdate("Sync stopped by user.");
            chrome.storage.local.set({ syncState: 'stopped' });
        }
    }
    return true; 
});

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

// Main sync function
async function syncAllCourses() {
    isSyncing = true;
    await chrome.storage.local.set({ syncState: 'syncing' });

    sendStatusUpdate("Starting sync");
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon48.png',
        title: 'HelloIITK Sync',
        message: 'Sync started. Checking for new files...'
    });

    try {
        const response = await fetch('https://hello.iitk.ac.in/courses');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();

        const courses = await parseHtmlViaOffscreen(html, 'parseCoursesPage');
        if (!isSyncing) throw new Error("Sync was cancelled.");

        sendStatusUpdate(`Processing ${courses.length} courses`);
        
        // Process all courses in parallel for speed
        const courseProcessingPromises = courses.map(course => {
            if (!isSyncing) return Promise.resolve(0);
            // Wrap each processCourse call in its own catch block.
            // This prevents one failed course from stopping the entire sync.
            return processCourse(course).catch(err => {
                console.error(`[${course.name}] A critical error occurred:`, err);
                sendStatusUpdate(`Error processing ${course.name}`);
                return 0; // Return 0 files for this course on error
            });
        });

        // Wait for all courses to be processed
        const fileCounts = await Promise.all(courseProcessingPromises);
        const totalNewFiles = fileCounts.reduce((sum, count) => sum + (count || 0), 0);

        const finalMessage = isSyncing 
            ? `Sync complete. Downloaded ${totalNewFiles} new file(s).`
            : `Sync stopped. Downloaded ${totalNewFiles} new file(s) before stopping.`;
        
        sendStatusUpdate(finalMessage);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: isSyncing ? 'Sync Complete' : 'Sync Stopped',
            message: finalMessage
        });

    } catch (error) {
        const errorMessage = `Error: ${error.message}`;
        console.error("Error during course sync:", error);
        if (error.message !== "Sync was cancelled.") {
            sendStatusUpdate(errorMessage);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon48.png',
                title: 'Sync Error',
                message: errorMessage
            });
        }
    } finally {
        isSyncing = false;
        await chrome.storage.local.set({ syncState: 'stopped' });
    }
}

// Processes a single course
async function processCourse(course) {
    if (!isSyncing) return 0;
    // Removed status update from here for a cleaner parallel experience.
    const resourcesUrl = `https://hello.iitk.ac.in/studio/${course.id}/student/resources`;

    try {
        const files = await scrapeResourcesPage(resourcesUrl);
        if (!isSyncing) return 0;

        console.log(`[${course.name}] Scraped ${files.length} file(s) from page.`);
        if (files.length === 0) return 0;

        const { [`downloaded_${course.id}`]: downloaded = [] } = await chrome.storage.local.get(`downloaded_${course.id}`);
        const downloadedSet = new Set(downloaded);
        const { savePath = 'HelloIITK_Downloads' } = await chrome.storage.local.get('savePath');

        let newFilesCount = 0;
        for (const file of files) {
            if (!isSyncing) break; // Check flag before each download
            if (!downloadedSet.has(file.href)) {
                // Removed download status update from here.
                const fileExtension = file.originalFilename.split('.').pop() || 'file';
                const safeTitle = file.title.replace(/[\\?%*:|"<>.\s]/g, '_');
                const filename = `${savePath}/${course.name}/Resources/${safeTitle}.${fileExtension}`;
                
                chrome.downloads.download({
                    url: file.href,
                    filename: filename,
                    saveAs: false
                });

                downloadedSet.add(file.href);
                newFilesCount++;
            }
        }
        
        await chrome.storage.local.set({ [`downloaded_${course.id}`]: Array.from(downloadedSet) });
        return newFilesCount;

    } catch (error) {
        console.error(`[${course.name}] Failed to process course:`, error);
        return 0;
    }
}

// Scrapes a resources page using a hidden tab
async function scrapeResourcesPage(url) {
    return new Promise(async (resolve, reject) => {
        // Early exit if sync was stopped before we even created a tab
        if (!isSyncing) {
            return reject(new Error("Sync was cancelled."));
        }
        
        const tab = await chrome.tabs.create({ url: url, active: false });
        
        try {
            // The content script will wait for the page to load, so we just execute it.
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: contentScript 
            });

            // Check status again after scraping, before closing the tab
            if (!isSyncing) {
                try { await chrome.tabs.remove(tab.id); } catch(e) {}
                return reject(new Error("Sync was cancelled."));
            }

            await chrome.tabs.remove(tab.id);
            resolve(results[0].result || []);
        } catch (e) {
            console.error("Error injecting script or scraping page:", e);
            // Clean up the tab on error
            try { await chrome.tabs.remove(tab.id); } catch(e) {}
            reject(e); // Propagate the error to be caught by processCourse
        }
    });
}

// Content script that runs on the resources page
function contentScript() {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            const resourceElements = document.querySelectorAll('student-resources-list');
            if (resourceElements.length > 0) {
                clearInterval(interval);
                const files = [];
                resourceElements.forEach(elem => {
                    try {
                        const titleElem = elem.querySelector('.fs-5.fst-normal');
                        const linkElem = elem.querySelector('a[target="_blank"]');
                        if (titleElem && linkElem) {
                            files.push({
                                title: titleElem.textContent.trim(),
                                href: linkElem.href,
                                originalFilename: linkElem.textContent.trim()
                            });
                        }
                    } catch (e) { console.error('Error parsing a resource element:', e); }
                });
                resolve(files);
            } else if (attempts > 20) { // Wait up to 10 seconds
                clearInterval(interval);
                resolve([]);
            }
            attempts++;
        }, 500);
    });
}

// --- Offscreen Document Logic ---
async function parseHtmlViaOffscreen(html, action) {
    if (!(await hasOffscreenDocument(OFFSCREEN_DOCUMENT_PATH))) {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['DOM_PARSER'],
            justification: 'To parse HTML content from the main /courses page.',
        });
    }
    return await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: action,
        html: html
    });
}

async function hasOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
}

