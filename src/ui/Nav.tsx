// Floating glass nav pill, detached from the top edge. On small screens the
// hamburger morphs into an X and opens a full-screen staggered menu.
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Action, shortAddress } from './kit';
import { ArrowUpRight } from './icons';

const links = [
  { to: '/', label: 'Market' },
  { to: '/how', label: 'How trust works' },
  { to: '/deals', label: 'My deals' },
  { to: '/sell', label: 'Sell' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 px-4 pt-6" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}>
        <nav className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-full
          bg-paper/70 p-2 pl-5 ring-1 ring-ink/[0.06] backdrop-blur-2xl">
          <Link to="/" className="font-display text-lg tracking-[-0.03em]">
            wafiqr
          </Link>

          <div className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-[13px] transition-all duration-500 ease-fluid
                   ${isActive ? 'bg-ink/[0.06] text-ink' : 'text-ink-mute hover:text-ink'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link to="/account" className="rounded-full px-4 py-2 text-[13px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink">
                  {profile?.walletAddress ? shortAddress(profile.walletAddress) : profile?.displayName ?? 'Account'}
                </Link>
                <Action variant="ghost" onClick={() => signOut()}>
                  Sign out
                </Action>
              </>
            ) : (
              <Action trailing={<ArrowUpRight size={13} />} onClick={() => navigate('/signin')}>
                Sign in
              </Action>
            )}
          </div>

          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full
              bg-ink/[0.05] transition-all duration-700 ease-fluid active:scale-95 md:hidden"
          >
            <span
              className={`absolute h-px w-4 bg-ink transition-all duration-700 ease-fluid
                ${open ? 'rotate-45' : '-translate-y-1'}`}
            />
            <span
              className={`absolute h-px w-4 bg-ink transition-all duration-700 ease-fluid
                ${open ? '-rotate-45' : 'translate-y-1'}`}
            />
          </button>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-20 bg-paper/85 backdrop-blur-3xl transition-all duration-700 ease-fluid md:hidden
          ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <div className="flex h-full flex-col justify-center gap-2 px-8">
          {links.map((link, i) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-display text-4xl tracking-[-0.03em] transition-all duration-700 ease-fluid
                ${open ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
              style={{ transitionDelay: `${80 + i * 60}ms` }}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-10">
            {user ? (
              <Action variant="ghost" onClick={() => signOut()}>Sign out</Action>
            ) : (
              <Action trailing={<ArrowUpRight size={13} />} onClick={() => navigate('/signin')}>
                Sign in
              </Action>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
