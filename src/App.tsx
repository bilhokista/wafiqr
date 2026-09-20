import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { isFirebaseConfigured } from './lib/firebase';
import { Nav } from './ui/Nav';
import { Footer } from './ui/Footer';
import { Spinner } from './ui/kit';
import { Market } from './routes/Market';

// The market is the entry point, so it ships in the first chunk. Everything that
// signs a transaction pulls the Stellar SDK and loads only when it is opened.
const Lot = lazy(() => import('./routes/Lot').then((m) => ({ default: m.Lot })));
const DealRoom = lazy(() => import('./routes/DealRoom').then((m) => ({ default: m.DealRoom })));
const Deals = lazy(() => import('./routes/Deals').then((m) => ({ default: m.Deals })));
const Sell = lazy(() => import('./routes/Sell').then((m) => ({ default: m.Sell })));
const SignIn = lazy(() => import('./routes/SignIn').then((m) => ({ default: m.SignIn })));
const Account = lazy(() => import('./routes/Account').then((m) => ({ default: m.Account })));
const How = lazy(() => import('./routes/How').then((m) => ({ default: m.How })));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="grain" aria-hidden="true" />
        <Nav />
        {!isFirebaseConfigured && (
          <div className="mx-auto mt-4 max-w-4xl px-4">
            <div className="rounded-2xl bg-amber/10 px-4 py-3 text-[12px] text-ink-soft ring-1 ring-amber/20">
              Firebase is not configured, so accounts and saved lots are unavailable. Copy
              <code className="mx-1 font-mono">.env.example</code> to
              <code className="mx-1 font-mono">.env</code> and fill in the project keys.
            </div>
          </div>
        )}
        <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-32 text-ink-mute md:px-8"><Spinner /></div>}>
        <Routes>
          <Route path="/" element={<Market />} />
          <Route path="/how" element={<How />} />
          <Route path="/lot/:id" element={<Lot />} />
          <Route path="/deal/:id" element={<DealRoom />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-40 md:px-8">
      <h1 className="text-[clamp(2.5rem,7vw,5rem)] leading-[0.95]">Nothing here.</h1>
      <p className="mt-6 text-ink-soft">The page moved, or the link was mistyped.</p>
    </main>
  );
}
