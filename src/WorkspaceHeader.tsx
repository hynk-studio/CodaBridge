import { useLayoutEffect, useRef, useState } from "react";

const workspaces = [
  ["listen", "Listen"],
  ["composer", "Composer"],
  ["lab", "Context Lab"],
  ["exchange", "Exchange"],
] as const;
export type Workspace = (typeof workspaces)[number][0];

export default function WorkspaceHeader({ current, onNavigate }: {
  current: Workspace;
  onNavigate: (workspace: Workspace) => void;
}) {
  const header = useRef<HTMLElement>(null);
  const space = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const switcher = useRef<HTMLSelectElement>(null);
  const [compact, setCompact] = useState(false);

  const measureOffset = () => {
    const element = header.current;
    const height = element && getComputedStyle(element).position === "sticky"
      ? element.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--header-offset", `${Math.ceil(height)}px`);
  };
  useLayoutEffect(() => {
    // Measure the full, unbroken labels, including when the native switcher is
    // visible. Text scaling and viewport changes affect layout only, never the
    // selected workspace, creation, playback or pending request.
    const measure = () => {
      setCompact(tabs.current!.getBoundingClientRect().width > space.current!.clientWidth);
      measureOffset();
    };
    const observer = new ResizeObserver(measure);
    [header.current!, space.current!, tabs.current!].forEach(element => observer.observe(element));
    measure();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--header-offset");
    };
  }, []);
  useLayoutEffect(() => {
    measureOffset();
    // Keep keyboard focus visible if its navigation control changes shape.
    // Focus elsewhere (including a question or answer) is left alone.
    if (compact && tabs.current?.contains(document.activeElement)) {
      switcher.current?.focus({ preventScroll: true });
    } else if (!compact && document.activeElement === switcher.current) {
      tabs.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    }
  }, [compact]);

  return (
    <header ref={header} className="site-header" data-compact={compact}>
      <a href="#workspace" className="wordmark" aria-label="CodaBridge home" onClick={event => {
        event.preventDefault();
        onNavigate("listen");
      }}>
        <span className="brand-mark" aria-hidden="true">ı┃ı┃ı</span>
        CodaBridge
      </a>
      <nav ref={space} className="product-navigation" aria-label="CodaBridge workspace">
        <div className="workspace-tabs-frame" inert={compact} aria-hidden={compact}>
        <div ref={tabs} className="workspace-tabs">
          {workspaces.map(([id, name]) => (
            <button key={id} aria-pressed={current === id} onClick={() => onNavigate(id)}>{name}</button>
          ))}
        </div>
        </div>
        <label className="workspace-switcher" hidden={!compact}>
          <span className="sr-only">Workspace</span>
          <select ref={switcher} value={current} onChange={event => onNavigate(event.target.value as Workspace)}>
            {workspaces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </nav>
    </header>
  );
}
