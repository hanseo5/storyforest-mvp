# 🚀 Storyforest Vercel Deployment Guide

This guide will walk you through deploying your **Storyforest** web app to Vercel for free. This is the best way to submit your "Public Project Link" for the hackathon.

---

## ✅ Step 1: Push Code to GitHub

First, we need to upload your project code to GitHub.

1.  **Log in to GitHub** (https://github.com) and click the **+** icon (top right) -> **New repository**.
2.  Name it `storyforest-mvp` (or similar).
3.  **Important:** Set visibility to **Public** (Required by Hackathon rules).
4.  Click **Create repository**.
5.  Open your VS Code terminal (where the app is running) and run these commands **one by one**:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Ready for hackathon submission"

# Link to your new GitHub repo
# REPLACE THE URL BELOW with your actual repo URL!
git remote add origin https://github.com/YOUR_USERNAME/storyforest-mvp.git

# Push the code
git branch -M main
git push -u origin main
```

---

## ☁️ Step 2: Deploy on Vercel

1.  Go to **[vercel.com](https://vercel.com)** and **Log In** (Continue with GitHub is easiest).
2.  On your dashboard, click **"Add New..."** -> **"Project"**.
3.  You will see "Import Git Repository". Find your `storyforest-mvp` repo and click **Import**.
4.  **Configure Project:**
    *   **Framework Preset:** It should auto-detect "Vite". If not, select it.
    *   **Root Directory:** Leave as `./`
    *   **Build Command:** `npm run build` (Default)
    *   **Output Directory:** `dist` (Default)
5.  **🚨 CRITICAL STEP: Environment Variables 🚨**
    *   Expand the **"Environment Variables"** section.
    *   You need to add the keys from your `.env` file here. Open your local `.env` file and copy-paste them one by one:

    | Name | Value |
    | :--- | :--- |
    | `VITE_FIREBASE_API_KEY` | (Your Firebase API Key) |
    | `VITE_FIREBASE_AUTH_DOMAIN` | (Your Auth Domain) |
    | `VITE_FIREBASE_PROJECT_ID` | (Your Project ID) |
    | `VITE_FIREBASE_STORAGE_BUCKET` | (Your Storage Bucket) |
    | `VITE_FIREBASE_MESSAGING_SENDER_ID` | (Your Sender ID) |
    | `VITE_FIREBASE_APP_ID` | (Your App ID) |
    | `VITE_GEMINI_API_KEY` | (Your Gemini API Key) |
    | `VITE_ELEVENLABS_API_KEY` | (Your ElevenLabs API Key) |
    | `VITE_ECOMMERCE_API_KEY` | (Your payment key) |

    *   *Tip: You can copy the entire content of your `.env` file and verify if Vercel has a bulk paste option, or just do it manually to be safe.*

6.  Click **Deploy**.

---

## 🎉 Step 3: Verification

1.  Vercel will build your app (takes about 1-2 minutes).
2.  Once done, you will see a **"Congratulations!"** screen.
3.  Click the **Preview Image** or the **Visit** button.
4.  **Test specific features:**
    *   Create a story (Tests Gemini API)
    *   Record a voice (Tests Microphone)
    *   Refresh the page on a sub-route (Tests `vercel.json` routing)

---

## 🔗 Final Step for Hackathon

Copy the domain Vercel gave you (e.g., `https://storyforest-mvp.vercel.app`) and paste it into:
1.  Your `SUBMISSION.md` checklist.
2.  The Hackathon submission form on Devpost under "Public Project Link".
