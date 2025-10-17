document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selection ---
    const syncBtn = document.getElementById('sync-btn');
    const syncBtnText = document.getElementById('sync-btn-text');
    const statusDiv = document.getElementById('status');
    const backgroundInfo = document.getElementById('background-info');
    const pathInput = document.getElementById('path-input');
    const savePathBtn = document.getElementById('save-path-btn');
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const currentPathDisplay = document.getElementById('current-path-display');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    const defaultPath = 'HelloIITK_Downloads';
    let loadingInterval = null;

    // --- SVG Icons for Status ---
    const icons = {
        idle: `<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
        syncing: `<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        complete: `<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    };

    // --- Functions ---
    const updateStatus = (text, type = 'idle') => {
        if (loadingInterval) clearInterval(loadingInterval);
        statusDiv.className = `status-bar status-${type}`;
        statusDiv.innerHTML = `${icons[type]} <span id="status-text">${text}</span>`;
    };

    const setSyncButtonState = () => {
        syncBtn.classList.remove('syncing');
        syncBtnText.textContent = 'Sync All Course Files';
        syncBtn.dataset.action = 'sync';
    };

    const setStopButtonState = () => {
        syncBtn.classList.add('syncing');
        syncBtnText.textContent = 'Stop Sync';
        syncBtn.dataset.action = 'stop';
    };
    
    // --- Initial Setup ---
    chrome.storage.local.get(['savePath', 'syncState'], (data) => {
        const currentPath = data.savePath || defaultPath;
        pathInput.placeholder = currentPath;
        currentPathDisplay.textContent = currentPath;

        if (data.syncState === 'syncing') {
            setStopButtonState();
            updateStatus('Sync in progress...', 'syncing');
            backgroundInfo.classList.add('visible');
        } else {
            setSyncButtonState();
        }
    });

    // --- Event Listeners ---
    syncBtn.addEventListener('click', () => {
        if (syncBtn.dataset.action === 'sync') {
            chrome.runtime.sendMessage({ action: 'syncAllCourses' });
            backgroundInfo.classList.add('visible');
        } else {
            chrome.runtime.sendMessage({ action: 'stopSync' });
            backgroundInfo.classList.remove('visible');
        }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateStatus') {
            if (loadingInterval) clearInterval(loadingInterval);

            const baseMessage = message.message;
            const isComplete = baseMessage.toLowerCase().includes('complete');
            const isError = baseMessage.toLowerCase().includes('error');
            const isStopped = baseMessage.toLowerCase().includes('stopped');
            const isFinalMessage = isComplete || isError || isStopped || baseMessage.toLowerCase().includes('cleared') || baseMessage.toLowerCase().includes('updated');

            if (isFinalMessage) {
                const statusType = isError ? 'error' : 'complete';
                updateStatus(baseMessage, statusType);
                setSyncButtonState();
                backgroundInfo.classList.remove('visible');
            } else {
                updateStatus(baseMessage, 'syncing');
                setStopButtonState();
                backgroundInfo.classList.add('visible');
                const statusSpan = document.getElementById('status-text');
                let dotCount = 1;
                loadingInterval = setInterval(() => {
                    dotCount = (dotCount % 3) + 1;
                    const dots = '.'.repeat(dotCount);
                    if(statusSpan) statusSpan.textContent = `${baseMessage}${dots}`;
                }, 400);
            }
        }
    });

    settingsToggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('visible');
        const isVisible = settingsPanel.classList.contains('visible');
        settingsToggleBtn.setAttribute('aria-expanded', isVisible);
    });

    savePathBtn.addEventListener('click', () => {
        let newPath = pathInput.value.trim() || defaultPath;
        chrome.storage.local.set({ savePath: newPath }, () => {
            currentPathDisplay.textContent = newPath;
            pathInput.value = '';
            pathInput.placeholder = newPath;
            updateStatus('Status: Save folder updated.', 'complete');
        });
    });

    clearHistoryBtn.addEventListener('click', () => {
        chrome.storage.local.get(null, (items) => {
            const keysToRemove = Object.keys(items).filter(key => key.startsWith('downloaded_'));
            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    updateStatus('Status: Download history cleared.', 'complete');
                });
            } else {
                updateStatus('Status: No download history to clear.', 'idle');
            }
        });
    });
});

