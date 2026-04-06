// ============================================================
// THE PRESS — App.js
// Root component with Solana wallet providers and routing
// ============================================================

import React, { useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { Toaster } from 'react-hot-toast';

import { RPC_ENDPOINT } from './lib/solana';
import { registerUser } from './lib/supabase';
import { Feed } from './pages/Feed';
import { Profile } from './pages/Profile';
import { PostPage } from './pages/PostPage';
import { Search } from './pages/Search';

import '@solana/wallet-adapter-react-ui/styles.css';
import './styles/global.css';

const WalletRegistrar = () => {
  const { publicKey } = useWallet();
  useEffect(() => {
    if (publicKey) registerUser(publicKey.toBase58());
  }, [publicKey]);
  return null;
};

export default function App() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <WalletRegistrar />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#1a1a2e',
                  color: '#f5f0e8',
                  border: '1px solid #c8a84b',
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '13px',
                },
              }}
            />
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/post/:id" element={<PostPage />} />
              <Route path="/profile/:wallet" element={<Profile />} />
              <Route path="/search" element={<Search />} />
            </Routes>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
