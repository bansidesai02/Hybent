"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { SOLUTIONS_SECTIONS } from "@/lib/solutions-menu";

function Link({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

// Desktop opens on hover; a small delay stops the panel flickering when the
// pointer crosses the gap between the trigger and the panel.
const CLOSE_DELAY = 120;

export default function SolutionsMegaMenu() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(SOLUTIONS_SECTIONS[0].key);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active =
    SOLUTIONS_SECTIONS.find((s) => s.key === activeKey) ?? SOLUTIONS_SECTIONS[0];

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
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-medium text-slate-700 transition hover:text-[#0B1220] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2"
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
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-50 w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 pt-3"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.28)]">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
              {/* Left rail — section switcher */}
              <div className="border-b border-slate-200 bg-gradient-to-b from-[#F4F8FF] to-[#F7F4FF] p-5 lg:border-b-0 lg:border-r">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Solutions
                </p>

                <div className="mt-4 flex gap-2 lg:flex-col">
                  {SOLUTIONS_SECTIONS.map((section) => {
                    const isActive = section.key === active.key;
                    return (
                      <button
                        key={section.key}
                        type="button"
                        onMouseEnter={() => setActiveKey(section.key)}
                        onFocus={() => setActiveKey(section.key)}
                        onClick={() => setActiveKey(section.key)}
                        aria-current={isActive}
                        className={`group flex flex-1 items-center justify-between rounded-2xl px-3.5 py-3 text-left transition lg:flex-none ${
                          isActive
                            ? "bg-white shadow-[0_6px_20px_-10px_rgba(15,23,42,0.3)]"
                            : "hover:bg-white/60"
                        }`}
                      >
                        <span>
                          <span
                            className={`block text-[15px] font-semibold ${
                              isActive
                                ? "bg-gradient-to-r from-[#3B9EFF] to-[#A855F7] bg-clip-text text-transparent"
                                : "text-slate-700"
                            }`}
                          >
                            {section.label}
                          </span>
                          <span className="mt-0.5 hidden text-xs leading-snug text-slate-500 lg:block">
                            {section.blurb}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`ml-3 shrink-0 text-slate-400 transition-transform ${
                            isActive ? "translate-x-0.5 text-[#A855F7]" : "group-hover:translate-x-0.5"
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
                  className="mt-5 hidden items-center gap-1.5 px-3.5 text-sm font-semibold text-[#6366F1] underline-offset-4 hover:underline lg:inline-flex"
                >
                  View all {active.label.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>

              {/* Right panel — groups for the active section */}
              <div className="max-h-[min(70vh,560px)] overflow-y-auto p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
                  {active.groups.map((group) => (
                    <div key={group.title} className="min-w-0">
                      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <span
                          aria-hidden="true"
                          className="h-1 w-5 shrink-0 rounded-full bg-gradient-to-r from-[#3B9EFF] to-[#A855F7]"
                        />
                        {group.title}
                      </h3>

                      <ul className="mt-3 space-y-0.5">
                        {group.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="block rounded-lg px-2 py-1.5 text-[14.5px] leading-snug text-slate-600 transition hover:bg-slate-50 hover:text-[#0B1220] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
                <p className="text-sm text-slate-600">
                  Not sure which one you need? Describe the problem instead.
                </p>
                <Link
                  href="/get-in-touch"
                  onClick={() => setOpen(false)}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-[#3B9EFF] to-[#A855F7] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(99,102,241,0.9)] transition hover:brightness-[1.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2"
                >
                  Get in Touch
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
