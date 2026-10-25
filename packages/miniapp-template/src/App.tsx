import { useEffect, useState } from "react";
import { QChat, QChatError, type AppInfo, type SystemInfo } from "./sdk";

type Profile = { nickname: string; qchatId: string } | null;

export default function App() {
  const [app, setApp] = useState<AppInfo | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [count, setCount] = useState(0);
  const [image, setImage] = useState<string | null>(null);
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

  async function run(action: () => Promise<void>) {
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

  return (
    <main>
      <header>
        <div className="mark">Q</div>
        <div>
          <p className="eyebrow">QChat Mini App</p>
          <h1>{app?.name ?? "Template"}</h1>
        </div>
        {app && <span className="pill">v{app.version}</span>}
      </header>

      <section className="card">
        <h2>Bridge</h2>
        <p className="muted">
          {app
            ? `${app.appId} · runtime ${app.runtimeVersion}`
            : "Connecting to the QChat host..."}
        </p>
        <div className="row">
          <button onClick={() => void run(() => QChat.showToast("Hello from Template"))}>
            Show toast
          </button>
          <button
            className="secondary"
            onClick={() =>
              void run(async () => {
                const next = count + 1;
                await QChat.setStorage("counter", next);
                setCount(next);
              })
            }
          >
            Counter: {count}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Host APIs</h2>
        <div className="row">
          <button
            className="secondary"
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
            className="secondary"
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
            className="secondary"
            onClick={() =>
              void run(async () => {
                await QChat.share({ text: "Built with QChat Mini Apps", url: "https://qchat.example" });
              })
            }
          >
            Share
          </button>
          <button
            className="secondary"
            onClick={() => void run(async () => {
              const friends = await QChat.request<{ items?: unknown[] }>("/friends");
              setStatus(`${friends.items?.length ?? 0} friends`);
            })}
          >
            Read friends
          </button>
        </div>
        {profile && (
          <p className="profile">
            {profile.nickname} <span>@{profile.qchatId}</span>
          </p>
        )}
        {image && <img className="preview" src={image} alt="Chosen" />}
        {status && <p className="status">{status}</p>}
      </section>

      <section className="card">
        <h2>System</h2>
        {system ? (
          <dl>
            <div><dt>Platform</dt><dd>{system.platform} {system.osVersion}</dd></div>
            <div><dt>Locale</dt><dd>{system.locale}</dd></div>
            <div><dt>Theme</dt><dd>{system.theme}</dd></div>
            <div><dt>Screen</dt><dd>{Math.round(system.screenWidth)} × {Math.round(system.screenHeight)}</dd></div>
          </dl>
        ) : (
          <p className="muted">Waiting for the host...</p>
        )}
      </section>

      <footer>
        <button className="link" onClick={() => void run(() => QChat.closeMiniApp())}>
          Close Mini App
        </button>
      </footer>
    </main>
  );
}
