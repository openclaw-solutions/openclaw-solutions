---
title: Proton Mail body appears blank because popup blocks decrypted message
category: email
tags: [proton, email, browser-automation, popup, decryption]
symptoms: ["Proton email body blank", "email visible in inbox but body not readable", "upgrade popup blocks Proton"]
last_verified: 2026-05-17
confidence: high
risk: privacy
requires_human_approval: false
---

# Proton Mail body appears blank because popup blocks decrypted message

## Problem / symptom
The inbox loads and the message row is visible, but the email body appears blank or cannot be extracted. Automation may click a row and nothing useful happens.

## Environment
- Proton Mail web client
- Browser automation with Puppeteer/Chromium
- Message body decrypts client-side after opening

## Root cause
A Proton modal/upsell popup can block the message body. Also, the React UI may not open a conversation from synthetic mouse clicks alone. After opening, message decryption takes time.

## Fix
1. Log in and navigate to inbox.
2. Dismiss all visible popups (`Close`, `Dismiss`, `Maybe later`, `Not now`).
3. Find the conversation row by subject/text.
4. Click/select the row, then press `Enter` to open.
5. Wait 12-15 seconds for client-side decryption.
6. Dismiss popups again.
7. Extract `document.body.innerText` or a narrower message container.

## Verification
- Body text appears after the wait.
- The extracted text includes sender/recipient/body details, not just inbox labels.

## Caveats / risks
- Email content can contain private data. Do not paste raw email bodies into public logs or solution cards.
- Store credentials only in local secrets or environment variables.
- Avoid killing unrelated browser sessions unless the workflow explicitly owns them.

## Search phrases
- Proton body blank
- Proton upgrade popup blocking email body
- Proton Puppeteer Enter opens message
- Proton decrypt wait

## Source / credit
Sanitized field report.
