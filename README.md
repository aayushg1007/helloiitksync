# HelloIITK Sync

A browser extension to automatically download and organize course materials from the HelloIITK portal.

## Overview

`helloiitksync` is a Chrome extension designed to automate the process of downloading lectures, notes, and other resources from the HelloIITK course portal. It discovers all your registered courses, scrapes the resource pages in parallel, and downloads new files into a clean, organized folder structure on your local machine.

## Key Features

* **Automatic Course Discovery:** Finds all your current courses from the dashboard automatically. No manual setup needed.
* **Parallel Downloads:** Scrapes all courses simultaneously for a significantly faster sync process.
* **Handles Dynamic Pages:** Capable of scraping modern, JavaScript-rendered resource pages.
* **Smart File Organization:** Saves files to a structured path: `Your_Downloads_Folder/{Custom Subfolder}/{Course Name}/Resources/{File Name}`.
* **Duplicate Prevention:** Keeps a history of downloaded files to avoid re-downloading them on subsequent syncs.
* **Configurable Settings:**
    * Set a custom sub-folder name for all your downloads.
    * Clear the download history to force a re-download of all files to a new location.
* **Interactive UI:**
    * Modern, clean interface with clear status updates.
    * Ability to start and stop the sync process.
    * Runs in the background, so you can close the popup and continue working.

## Installation & Usage

1.  Download the project folder and save it to a permanent location on your computer.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** using the toggle in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the extension's project folder.
6.  Pin the extension to your toolbar for easy access.
7.  Open the extension popup, configure your desired save folder in the settings, and click **"Sync All Course Files"**.

---

*This is an unofficial tool and is not affiliated with IIT Kanpur.*
