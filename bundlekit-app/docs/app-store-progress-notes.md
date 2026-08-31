# BundleKit App Store Notes — Easy Version

Last updated: August 28, 2026

This is a simple diary of what we fixed to get closer to Shopify App Store
approval, written so you (or anyone else) can understand it later without
digging through chat history.

## The big picture

Shopify has a checklist before you can submit BundleKit for review. We went
through it step by step. Most of the "must fix" items are now done. A few
things still need you personally (logging into a form, deciding on a
feature, producing screenshots/video).

## What was broken, in plain words

1. **Fake placeholder web address.** The app's settings said its address was
   `https://example.com` — a placeholder that was never replaced with the
   real one. Shopify blocks submission if it sees this.
2. **Missing "delete my data" webhooks.** Shopify requires every app to
   promise 3 things: "if asked, I can tell you what data I have on a
   customer," "if asked, I will delete a customer's data," and "if the shop
   deletes the app, I will delete the shop's data." Two of these three were
   turned off in the settings.
3. **Wrong instructions in the Help page.** The Help page told merchants
   "your discount stacks with other discounts by default" — but the actual
   app code does the opposite (it does NOT stack by default). We fixed the
   words to match the real behavior.
4. **Marketing website didn't match the app.** The website said the
   "Analytics" feature was only in the most expensive plan (Pro), but the
   app actually gives Analytics in the middle plan (Grow) too. Also the
   website never mentioned the free 14-day trial. Fixed both.
5. **No real Privacy Policy page.** We had a privacy policy written, but it
   was sitting in a private file, not a real web page anyone could visit.
   We published it at bundlekit.mpctrades.com/privacy.html and fixed a
   wrong contact email inside it (it had a typo'd domain that didn't match
   the real company email).
6. **The app was never actually running on the internet.** This was the
   biggest one. The web address `bundlekit.mpctrades.com` only had the
   marketing website on it — the actual app (the part merchants install and
   use) was never turned on there. So Shopify's test signals (like "can you
   log a merchant in," "do you respond correctly to webhooks") all failed,
   because there was genuinely nothing there to answer.

## How we fixed #6 (the big one)

Think of it like this: the website (brochure) and the app (the actual
software) are two different things that need to both live at the same web
address. Before, only the brochure was plugged in.

Step by step, here's what got done on the server:

1. Found the correct server (the app's address was pointing to a totally
   different server than we assumed at first — worth double-checking this
   if it ever seems broken again).
2. Pulled the latest app code onto that server (`git pull`).
3. Created a separate, dedicated database for the real app to use — kept
   completely separate from the practice/testing database, so real
   merchant data never mixes with test data.
4. Installed the app's dependencies and built it for production
   (`npm install`, `npm run build`).
5. Set up the database tables (`npm run setup`).
6. Started the app as a background service (using a tool called `pm2`,
   which keeps it running even after we log out, and restarts it
   automatically if the server reboots).
7. Told the web server (`nginx`) — the traffic director for the domain —
   "if someone visits `/app`, `/auth`, `/webhooks`, `/api`, or `/assets`,
   send them to the app. Everything else, keep showing the marketing
   website like before." This is what makes both the brochure and the real
   app work on the same address without conflicting.
8. Reloaded the web server and tested every route from outside to confirm
   it actually works.

**Note for later:** if the app ever needs restarting on the server, the
command is `pm2 restart bundlekit`. To see its logs: `pm2 logs bundlekit`.

## What's still open (needs you specifically)

These can't be done by an assistant alone — they need a decision from you,
your login, or real content you have to produce:

- [ ] **Fill in the "Create your listing content" form** in the Partner
      Dashboard. Clicking "Create" sends you to a separate Shopify login —
      log in there yourself, then we can help write the text parts (app
      name, short description, feature list). The pictures/video below are
      still needed too.
- [ ] **Take real screenshots** (3 to 6 of them, sized 1600×900). Rules:
      no pricing shown, no fake reviews, no browser address-bar frame, no
      revenue numbers that look like a guarantee.
- [ ] **Record a short screen-recording video** (2–3 minutes) showing:
      installing the app, creating a bundle offer, publishing it, and doing
      one real checkout where the price matches what was promised.
- [ ] **Make a demo store** — a working Shopify test store with the app
      installed and one bundle offer already live on a product page, so
      the Shopify reviewer can see it work immediately.
- [ ] **Run a "Lighthouse" speed test** before/after installing the widget,
      to prove it doesn't slow down the storefront by more than 10 points.
- [ ] **Place one real test order** through the storefront with the bundle
      discount applied, start to finish.
- [ ] **App icon**, 1200×1200 pixels, no text on it.
- [ ] **Decide about the "Powered by BundleKit" badge.** The marketing
      website promises this badge appears on the Free plan, but it was
      never actually built into the app. Either: (a) build the real badge
      into the storefront widget, or (b) remove the promise from the
      website. Your call.
- [ ] **Optional: install the "Shopify AI Toolkit"** and run
      `/shopify-app-store-review` — Shopify's own AI checks your app
      against their rules before you submit, which can speed up approval.

## What's done — quick checklist

- [x] Fixed the placeholder web addresses
- [x] Turned on all 3 required "delete my data" webhooks
- [x] Fixed the wrong Help page text about discount stacking
- [x] Matched the marketing website's pricing claims to the real app
- [x] Published a real Privacy Policy page and fixed its contact email
- [x] Got the real app actually running and reachable on the internet
- [x] Told Shopify what kind of app this is ("Embedded" + "Online store")
- [x] Passed Shopify's "Automated checks for common errors" — login works,
      redirects work, the 3 required webhooks work, signatures are
      verified correctly, and the security certificate is valid
