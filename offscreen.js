// This script runs in the offscreen document.
// It listens for messages from the service worker, parses HTML, and sends back the results.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only process messages specifically targeted to the 'offscreen' document.
    if (message.target !== 'offscreen') {
        return;
    }

    console.log("Offscreen document received a targeted message:", message.action);

    const parser = new DOMParser();
    const doc = parser.parseFromString(message.html, 'text/html');

    if (message.action === 'parseCoursesPage') {
        console.log("Action: parseCoursesPage. Parsing for course cards...");
        const courseCards = doc.querySelectorAll('div.course-card');
        console.log(`Found ${courseCards.length} course cards.`);
        
        const courseData = [];
        for (const card of courseCards) {
            const link = card.querySelector('a');
            if (link && link.href) {
                const courseName = card.querySelector('.course-id')?.textContent.trim().replace(/[\\?%*:|"<>]/g, '-') || 'Unknown-Course';
                const courseIdMatch = link.href.match(/\/studio\/([^\/]+)/);
                if (courseIdMatch && courseIdMatch[1]) {
                    courseData.push({
                        id: courseIdMatch[1],
                        name: courseName
                    });
                }
            }
        }
        console.log("Sending back course data:", courseData);
        sendResponse(courseData);

    } else if (message.action === 'parseResourcesPage') {
        console.log("Action: parseResourcesPage. Parsing for resource lists...");
        const resourceElements = doc.querySelectorAll('student-resources-list');
        console.log(`Found ${resourceElements.length} resource elements.`);

        const filesData = [];
        for (const resource of resourceElements) {
            const link = resource.querySelector('filedisplaydelete a[target="_blank"]');
            if (link && link.href) {
                const title = resource.querySelector('.fs-5')?.textContent.trim() || 'untitled';
                const originalFilename = link.textContent.trim();
                filesData.push({
                    href: link.href,
                    title: title,
                    originalFilename: originalFilename
                });
            }
        }
        console.log("Sending back files data:", filesData);
        sendResponse(filesData);
    }
    
    // Return true to indicate the response is sent asynchronously
    return true;
});

