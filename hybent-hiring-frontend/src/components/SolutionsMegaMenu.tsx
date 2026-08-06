"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { SOLUTIONS_SECTIONS, type SolutionSection, type SolutionGroup, type SolutionItem } from "@/lib/solutions-menu";

function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

const CLOSE_DELAY = 150;

export default function SolutionsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(SOLUTIONS_SECTIONS[0].key);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active =
    SOLUTIONS_SECTIONS.find((s: SolutionSection) => s.key === activeKey) ?? SOLUTIONS_SECTIONS[0];

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    <div
      ref={wrapRef}
      className="static lg:relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="navlink inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14.5px] font-medium text-slate-700 transition hover:text-[#0B1220] hover:bg-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
      >
        Solutions
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${open ? "rotate-180 text-[#6366F1] opacity-100" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 w-[min(1160px,calc(100vw-2rem))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 backdrop-blur-2xl shadow-[0_32px_80px_-16px_rgba(15,23,42,0.22)]">
            <div className="flex flex-col lg:flex-row">
              {/* Left sidebar — category selector */}
              <div className="w-full shrink-0 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 via-indigo-50/20 to-purple-50/30 p-5 lg:w-[310px] lg:border-b-0 lg:border-r flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#3B9EFF] to-[#A855F7]" />
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                      SOLUTIONS
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {SOLUTIONS_SECTIONS.map((section: SolutionSection) => {
                      const isActive = section.key === active.key;
                      return (
                        <button
                          key={section.key}
                          type="button"
                          onMouseEnter={() => setActiveKey(section.key)}
                          onFocus={() => setActiveKey(section.key)}
                          onClick={() => setActiveKey(section.key)}
                          aria-current={isActive}
                          className={`group relative flex w-full items-center justify-between rounded-2xl p-3.5 text-left transition-all duration-200 ${
                            isActive
                              ? "bg-white shadow-[0_4px_20px_-4px_rgba(76,111,255,0.16)] border border-indigo-100/90"
                              : "hover:bg-white/70 border border-transparent"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-gradient-to-b from-[#3B9EFF] to-[#A855F7]" />
                          )}
                          <div className={isActive ? "pl-2" : ""}>
                            <span
                              className={`block text-[14.5px] font-bold ${
                                isActive
                                  ? "bg-gradient-to-r from-[#3B9EFF] via-[#6366F1] to-[#A855F7] bg-clip-text text-transparent"
                                  : "text-slate-700 group-hover:text-slate-900"
                              }`}
                            >
                              {section.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                              {section.blurb}
                            </span>
                          </div>
                          <span
                            aria-hidden="true"
                            className={`ml-2 shrink-0 transition-transform duration-200 ${
                              isActive
                                ? "translate-x-0.5 text-[#A855F7]"
                                : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-slate-500"
                            }`}
                          >
                            →
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Link
                    href={active.href}
                    onClick={() => setOpen(false)}
                    className="group mt-4 inline-flex items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wider text-[#6366F1] transition-colors hover:text-[#4C6FFF]"
                  >
                    <span>View all {active.label.toLowerCase()}</span>
                    <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </Link>
                </div>

                {/* "Get in Touch" card */}
                <div className="mt-6 rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-blue-50/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">Need custom software?</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                        Describe your challenge &amp; get a proposal.
                      </p>
                    </div>
                    <Link
                      href="/contact"
                      onClick={() => setOpen(false)}
                      className="shrink-0 rounded-full bg-gradient-to-r from-[#4C6FFF] to-[#A855F7] px-3.5 py-2 text-xs font-bold text-white shadow-[0_4px_14px_-3px_rgba(76,111,255,0.6)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_6px_20px_-3px_rgba(76,111,255,0.8)] active:scale-[0.98]"
                    >
                      Get in Touch →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right content panel — multi-column grid */}
              <div className="flex-1 min-w-0 max-h-[min(72vh,580px)] overflow-y-auto p-6 lg:p-8 custom-scrollbar">
                <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
                  {active.groups.map((group: SolutionGroup) => (
                    <div key={group.title} className="min-w-0">
                      <div className="mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#3B9EFF] to-[#A855F7]" />
                        <h3 className="text-[10.5px] font-mono font-bold uppercase tracking-[0.14em] text-slate-400">
                          {group.title}
                        </h3>
                      </div>

                      <ul className="space-y-0.5">
                        {group.items.map((item: SolutionItem) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="group flex items-center justify-between rounded-xl px-3 py-1.5 text-[13.5px] font-medium text-slate-600 transition-all duration-150 hover:bg-indigo-50/60 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                            >
                              <span className="truncate">{item.label}</span>
                              <span
                                aria-hidden="true"
                                className="text-xs text-[#3B9EFF] opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0"
                              >
                                →
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
