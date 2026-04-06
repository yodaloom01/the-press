# 🗞️ The Press — Setup Guide

> Pay to publish. Memecoins power the feed. One meme could change everything.

---

## What You're Setting Up

- **Frontend**: React app with Solana wallet integration
- **Blockchain**: Real on-chain SPL token transfers (Phantom / Solflare)
- **Backend**: Supabase (free tier works fine to start)
- **Media storage**: Supabase Storage (images & videos)
- **Prices**: CoinGecko free API (no key needed)

---

## Prerequisites

Install these first if you don't have them:

1. **Node.js** → https://nodejs.org (download the LTS version)
2. **Phantom Wallet** → https://phantom.app (Chrome extension)
3. A free **Supabase account** → https://supabase.com

---

## Step 1 — Set Up Supabase (5 minutes)

1. Go to https://supabase.com → click **New Project**
2. Give it a name (e.g. "the-press"), set a database password, pick a region
3. Once created, go to the **SQL Editor** tab on the left
4. Open the file `supabase_schema.sql` from this folder
5. Copy all of it → paste into the SQL editor → click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key

---

## Step 2 — Configure Environment

1. In this folder, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   REACT_APP_PLATFORM_WALLET=your-wallet-address-here
   REACT_APP_SOLANA_NETWORK=devnet
   ```

**Getting your platform wallet address:**
- Open Phantom → copy your wallet address (looks like `5xK9...m3Qp`)
- This is where all the SPL token payments go

---

## Step 3 — Install & Run

Open a terminal in this folder and run:

```bash
npm install
npm start
```

The app will open at **http://localhost:3000**

---

## Step 4 — Test on Devnet First

Before going live on mainnet:

1. In Phantom wallet → click the network name at the top → switch to **Devnet**
2. Get free devnet SOL: https://faucet.solana.com
3. The app is set to `devnet` by default in your `.env`
4. Test a full post flow — upload an image, pay tokens, confirm transaction
5. Check your Supabase dashboard to see the post appear in the `posts` table

---

## Step 5 — Go Mainnet

When you're ready for real money:

1. Change `.env`:
   ```
   REACT_APP_SOLANA_NETWORK=mainnet-beta
   ```
2. Switch Phantom back to **Mainnet**
3. Get a better RPC endpoint for production (free tier at https://helius.dev):
   ```
   REACT_APP_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   ```
4. Restart the app: `npm start`

---

## Deploying to the Web

The easiest free hosting:

### Vercel (recommended)
```bash
npm install -g vercel
vercel
```
Add your `.env` variables in the Vercel dashboard under **Settings → Environment Variables**

### Netlify
```bash
npm run build
# Then drag the /build folder to netlify.com/drop
```

---

## How the Payment Flow Works

```
User selects coin + amount
        ↓
User clicks "Press It"
        ↓
App calls transferSplToken()
        ↓
Phantom/Solflare popup appears
        ↓
User approves → transaction signed
        ↓
Solana confirms the tx (~2 seconds)
        ↓
App gets the tx signature
        ↓
Post saved to Supabase with signature as proof
        ↓
Post appears live in feed via real-time subscription
```

---

## File Structure

```
the-press/
├── src/
│   ├── lib/
│   │   ├── solana.js        ← All Solana/SPL token logic
│   │   └── supabase.js      ← Database helpers
│   ├── hooks/
│   │   ├── useCoinPrices.js ← Live prices from CoinGecko
│   │   └── useTokenBalance.js ← User's token balance
│   ├── components/
│   │   ├── Header.js        ← Header + ticker + wallet button
│   │   ├── PostCard.js      ← Individual post display
│   │   └── PressModal.js    ← Pay-to-post modal
│   ├── pages/
│   │   ├── Feed.js          ← Main feed page
│   │   └── Profile.js       ← User profile page
│   └── styles/
│       └── global.css
├── supabase_schema.sql      ← Run this in Supabase first
├── .env.example             ← Copy to .env and fill in
└── package.json
```

---

## Adding More Coins

Open `src/lib/solana.js` and add to the `SUPPORTED_COINS` array:

```javascript
{
  ticker: 'MYTOKEN',
  name: 'My Token',
  emoji: '🚀',
  mint: 'MAINNET_MINT_ADDRESS_HERE',
  devnetMint: 'DEVNET_MINT_ADDRESS_HERE',
  decimals: 6,
  coingeckoId: 'my-token-coingecko-id',
}
```

---

## Support

Built with:
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)
- [@solana/spl-token](https://spl.solana.com/token)
- [@solana/wallet-adapter](https://github.com/solana-labs/wallet-adapter)
- [Supabase](https://supabase.com)
- [React](https://react.dev)

---

*The Press — One meme. One coin. One moment that changes everything.*
