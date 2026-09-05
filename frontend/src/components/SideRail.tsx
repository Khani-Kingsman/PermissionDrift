import React from 'react';
import { Home, Briefcase, User, Mail, Shield } from 'lucide-react';

interface SideRailProps {
  onScrollTo: (id: string) => void;
}

export const SideRail: React.FC<SideRailProps> = ({ onScrollTo }) => {
  return (
    <aside className="hidden lg:block fixed left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
      <div className="flex flex-col gap-2 bg-white/90 backdrop-blur-md border-neutral-200 border rounded-full p-2 shadow-xl items-center">
        <button
          className="group grid place-items-center hover:text-black hover:bg-neutral-100 transition relative text-neutral-400 w-10 h-10 rounded-full cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Home"
        >
          <Home className="w-4 h-4" />
          <span className="absolute left-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono">
            Home
          </span>
        </button>
        <button
          className="group grid place-items-center hover:text-black hover:bg-neutral-100 transition relative text-neutral-400 w-10 h-10 rounded-full cursor-pointer"
          onClick={() => onScrollTo('posture-console')}
          title="Posture Telemetry"
        >
          <Shield className="w-4 h-4 text-cyan-600" />
          <span className="absolute left-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono">
            Security Posture
          </span>
        </button>
        <button
          className="group grid place-items-center hover:text-black hover:bg-neutral-100 transition relative text-neutral-400 w-10 h-10 rounded-full cursor-pointer"
          onClick={() => onScrollTo('work')}
          title="Work"
        >
          <Briefcase className="w-4 h-4" />
          <span className="absolute left-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono">
            Work
          </span>
        </button>
        <button
          className="group grid place-items-center hover:text-black hover:bg-neutral-100 transition relative text-neutral-400 w-10 h-10 rounded-full cursor-pointer"
          onClick={() => onScrollTo('about')}
          title="About"
        >
          <User className="w-4 h-4" />
          <span className="absolute left-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono">
            About
          </span>
        </button>
        <button
          className="group grid place-items-center hover:text-black hover:bg-neutral-100 transition relative text-neutral-400 w-10 h-10 rounded-full cursor-pointer"
          onClick={() => onScrollTo('contact')}
          title="Contact"
        >
          <Mail className="w-4 h-4" />
          <span className="absolute left-12 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-geist-mono">
            Contact
          </span>
        </button>
      </div>
    </aside>
  );
};
