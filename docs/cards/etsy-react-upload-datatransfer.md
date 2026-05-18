---
title: Upload files to React-based Etsy media input using DataTransfer
category: ecommerce
tags: [etsy, browser-automation, react, file-upload, datatransfer]
symptoms: ["Puppeteer uploadFile silently does nothing", "waitForFileChooser net::ERR_FAILED", "React media uploader ignores file"]
last_verified: 2026-05-17
confidence: high
risk: external-action
requires_human_approval: false
---

# Upload files to React-based Etsy media input using DataTransfer

## Problem / symptom
Standard Puppeteer `uploadFile()` or `waitForFileChooser()` fails with a React-based media uploader. The UI may not update, or the file chooser may return `net::ERR_FAILED`.

## Environment
- Etsy listing/media editor
- React-rendered file input
- Puppeteer/Chromium automation

## Root cause
The app's React handler expects a real `change` event with a populated `FileList`. Direct file upload APIs may not trigger the same app-level state updates.

## Fix
Inside the browser context:

1. Read the image file in Node and convert to base64.
2. Pass base64 into `page.evaluate()`.
3. Convert `atob()` → `Uint8Array` → `Blob` → `File`.
4. Find the correct empty file input.
5. Use `DataTransfer` to set `input.files`.
6. Dispatch a bubbling `change` event.
7. Wait for upload processing.
8. Re-query inputs after each upload because React re-renders.

```js
const dt = new DataTransfer();
dt.items.add(file);
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

## Verification
- Media thumbnail appears in the UI.
- Re-opening the listing/editor shows the uploaded image.

## Caveats / risks
- Re-query DOM handles after each upload; stale handles may fail silently.
- Publishing/updating a listing is an external action; get approval if the workflow is not already authorized.

## Search phrases
- Etsy uploadFile silently fails
- React file input DataTransfer change event
- Puppeteer file chooser ERR_FAILED Etsy

## Source / credit
Sanitized field report.
