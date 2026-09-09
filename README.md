# Stone Plast — deploy guide

This folder contains the landing page (`index.html`) plus a serverless
function (`api/send.js`) that emails form submissions to
`alexforamazon79@gmail.com` using your own Gmail account — no third-party
form service, no per-submission fees.

```
stoneplast-site/
├─ index.html          the site
├─ api/
│  └─ send.js           serverless function, receives POSTs from both forms
├─ package.json          declares the nodemailer dependency
├─ .env.example           template for local env vars (copy to .env, don't commit)
└─ .gitignore
```

## 1. Create a Gmail "App Password"

Gmail won't let regular apps log in with your normal password anymore, so
you generate a special one just for this.

1. Turn on 2-Step Verification on the Gmail account you want to send FROM
   (this can be the same address as `alexforamazon79@gmail.com`, or a
   separate sending account — either works).
2. Go to https://myaccount.google.com/apppasswords
3. Create an app password (name it something like "Stone Plast site").
4. Copy the 16-character password it gives you — you'll paste it into
   Vercel in step 3. You won't be able to see it again after this screen.

## 2. Push this folder to GitHub

Vercel deploys straight from a GitHub repo.

```bash
cd stoneplast-site
git init
git add .
git commit -m "Stone Plast site with serverless contact form"
```

Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/stoneplast-site.git
git branch -M main
git push -u origin main
```

## 3. Deploy on Vercel

1. Go to https://vercel.com and sign up / log in (free tier is plenty for this).
2. Click "Add New Project" and import the GitHub repo you just pushed.
3. Before deploying, open **Environment Variables** and add three:

   | Name | Value |
   |---|---|
   | `GMAIL_USER` | the Gmail address you generated the app password for |
   | `GMAIL_APP_PASSWORD` | the 16-character app password from step 1 |
   | `TO_EMAIL` | `alexforamazon79@gmail.com` |

4. Click Deploy. Vercel installs `nodemailer` automatically from
   `package.json` and serves `index.html` at your new `.vercel.app` URL,
   with `/api/send` live as the function endpoint.

## 4. Test it

Open the deployed site, submit the contact form (bottom of page) and the
sample-request form (tap a swatch → Add to Sample Request → Request
samples in the tray). Both should show an inline "Message sent" line and
an email should land in `alexforamazon79@gmail.com` within a few seconds.

If you see an error message instead, check the Vercel dashboard →
your project → **Logs** tab — it will show the real error (most common
cause: a typo in one of the three environment variables, or 2-Step
Verification not actually turned on for the sending account).

## 5. Point your own domain at it (optional)

In the Vercel project → **Settings → Domains**, add `stoneplast.ir` (or
whichever domain you use) and follow the DNS instructions Vercel gives
you. HTTPS is issued automatically.

## Notes

- Both forms include a hidden honeypot field (`company`) — real visitors
  never see or fill it, so if it arrives populated the function silently
  discards the submission instead of emailing you spam.
- There's also a basic rate limiter (5 submissions/minute per IP) baked
  into `api/send.js` to blunt casual abuse. It resets whenever Vercel
  spins up a fresh instance of the function, so it's not a hard guarantee
  — fine for a small business contact form, not a substitute for real
  spam protection if this ever gets targeted.
- To change which inbox receives submissions later, just update the
  `TO_EMAIL` environment variable in Vercel — no code change needed.
