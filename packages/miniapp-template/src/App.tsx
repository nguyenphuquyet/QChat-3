import { useEffect, useState } from "react";
import { QChat, QChatError, type AppInfo, type SystemInfo } from "@qchat/miniapp-sdk";

type Profile = { nickname: string; qchatId: string } | null;

type Step = { id: string; label: string; hint: string };

// A tiny checklist so the starter shows a real screen, not only bridge calls.
// Replace it with your own feature; the header and card layout can stay.
const steps: Step[] = [
  { id: "app", label: "Create the app", hint: "Done in the Developer Center" },
  { id: "bridge", label: "Call the bridge", hint: "Toast, profile, storage" },
  { id: "ship", label: "Ship a build", hint: "Upload the ZIP and submit" },
];

export default function App() {
  const [app, setApp] = useState<AppInfo | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [count, setCount] = useState(0);
  const [friends, setFriends] = useState<number | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({ app: true });
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [info, sys, saved] = await Promise.all([
          QChat.getAppInfo(),
          QChat.getSystemInfo(),
          QChat.getStorage<number>("counter"),
        ]);
        setApp(info);
        setSystem(sys);
        setCount(saved ?? 0);
      } catch (error) {
        setStatus(error instanceof QChatError ? error.message : "Could not reach QChat");
      }
    })();
  }, []);

  useEffect(() => {
    // The host renders the mini app edge to edge, so honour the safe areas it
    // reports (env(safe-area-inset-*) stays 0 in the Android WebView).
    const root = document.documentElement;
    root.style.setProperty("--safe-top", `${system?.safeAreaTop ?? 0}px`);
    root.style.setProperty("--safe-bottom", `${system?.safeAreaBottom ?? 0}px`);
  }, [system]);

  async function run(action: () => Promise<unknown>) {
    setStatus("");
    try {
      await action();
    } catch (error) {
      if (error instanceof QChatError) {
        setStatus(`${error.code}: ${error.message}`);
      } else {
        setStatus("Something went wrong");
      }
    }
  }

  const completed = steps.filter((step) => done[step.id]).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <div className="app">
      {/* The host floats its menu and close buttons over the top right corner,
          which is why the header reserves the --capsule strip. */}
      <header className="app-bar">
        <div className="mark" aria-hidden="true">
          {(app?.name ?? "Q").trim().slice(0, 1).toUpperCase()}
        </div>
        <div className="titles">
          <p className="eyebrow">
            {app ? `v${app.version} · runtime ${app.runtimeVersion}` : "QChat Mini App"}
          </p>
          <h1 title={app?.name}>{app?.name ?? "Starter"}</h1>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <p className="hero-label">Good to see you</p>
          <h2 className="hero-name">{profile ? profile.nickname : "QChat user"}</h2>
          <p className="hero-sub">
            {profile ? `@${profile.qchatId}` : "Load the profile through the host bridge."}
          </p>
          <div className="stats">
            <div>
              <span>{count}</span>
              <small>Counter</small>
            </div>
            <div>
              <span>{friends ?? "—"}</span>
              <small>Friends</small>
            </div>
            <div>
              <span>{progress}%</span>
              <small>Setup</small>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Getting started</h2>
            <span className="pill">{completed}/{steps.length}</span>
          </div>
          <ul className="steps">
            {steps.map((step) => {
              const checked = Boolean(done[step.id]);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    className={`step${checked ? " checked" : ""}`}
                    aria-pressed={checked}
                    onClick={() => setDone((current) => ({ ...current, [step.id]: !checked }))}
                  >
                    <span className="tick" aria-hidden="true">{checked ? "✓" : ""}</span>
                    <span className="step-text">
                      <b>{step.label}</b>
                      <small>{step.hint}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2>Bridge demo</h2>
          <p className="muted">
            {app ? `${app.appId} · entry ${app.entry}` : "Connecting to the QChat host…"}
          </p>
          <div className="grid-actions">
            <button onClick={() => void run(() => QChat.showToast("Hello from the starter"))}>
              Show toast
            </button>
            <button
              className="ghost"
              onClick={() =>
                void run(async () => {
                  const next = count + 1;
                  await QChat.setStorage("counter", next);
                  setCount(next);
                })
              }
            >
              Counter +1
            </button>
            <button
              className="ghost"
              onClick={() =>
                void run(async () => {
                  const chosen = await QChat.chooseImage({ maxWidth: 1024, quality: 0.8 });
                  setImage(chosen.dataUrl);
                })
              }
            >
              Choose image
            </button>
            <button
              className="ghost"
              onClick={() =>
                void run(() =>
                  QChat.share({ text: "Built with QChat Mini Apps", url: "https://qchat.example" }),
                )
              }
            >
              Share
            </button>
          </div>
          <div className="row">
            <button
              className="ghost"
              onClick={() =>
                void run(async () => {
                  const me = await QChat.getUserInfo();
                  setProfile(me ? { nickname: me.nickname, qchatId: me.qchatId } : null);
                })
              }
            >
              Load profile
            </button>
            <button
              className="ghost"
              onClick={() =>
                void run(async () => {
                  const result = await QChat.request<{ items?: unknown[] }>("/friends");
                  setFriends(result.items?.length ?? 0);
                })
              }
            >
              Read friends
            </button>
          </div>
          {image && <img className="preview" src={image} alt="Chosen" />}
          {status && <p className="status">{status}</p>}
        </section>

        <section className="card">
          <h2>Device</h2>
          {system ? (
            <dl>
              <div><dt>Platform</dt><dd>{system.platform} {system.osVersion}</dd></div>
              <div><dt>Locale</dt><dd>{system.locale}</dd></div>
              <div><dt>Theme</dt><dd>{system.theme}</dd></div>
              <div><dt>Screen</dt><dd>{Math.round(system.screenWidth)} × {Math.round(system.screenHeight)}</dd></div>
            </dl>
          ) : (
            <p className="muted">Waiting for the host…</p>
          )}
        </section>
      </main>
    </div>
  );
}
