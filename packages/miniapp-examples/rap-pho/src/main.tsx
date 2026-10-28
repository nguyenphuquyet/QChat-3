import "@mna/qchat/env/auto";

import { navigateBack, navigateTo, start, useEffect, useLifecycle, useState } from "@mna/qchat";
import { TabBar, View } from "@mna/qchat/ui";
import type { TabItem } from "@mna/qchat/ui";
import { hydrate, ticketStats, useTickets } from "./store.js";
import { colors } from "./theme.js";
import { AccountScreen } from "./screens/account.js";
import { DiscoverScreen } from "./screens/discover.js";
import { LegalScreen } from "./screens/legal.js";
import { MovieScreen } from "./screens/movie.js";
import { MoviesScreen } from "./screens/movies.js";
import { TicketScreen } from "./screens/ticket.js";
import { TicketsScreen } from "./screens/tickets.js";

const TABS = [
  { key: "discover", label: "Khám phá", icon: "discover" },
  { key: "movies", label: "Phim", icon: "play" },
  { key: "tickets", label: "Vé", icon: "ticketPercent" },
  { key: "me", label: "Tôi", icon: "me" },
] as const;

function App() {
  const [index, setIndex] = useState(0);
  const [routes, setRoutes] = useState<string[]>([]);
  const route = routes.length > 0 ? routes[routes.length - 1] : null;
  const tickets = useTickets();
  const stats = ticketStats(tickets);

  useEffect(() => {
    void hydrate();
  }, []);

  // The host owns the route stack. It reports every push and pop, and the app
  // only decides which screen that path means. The local stack mirrors the host
  // so the screen for a lifecycle event is already the one on screen: the frame
  // it renders is what the host slides in, instead of a blank swap followed by
  // a second render that jumps.
  useLifecycle((event, payload) => {
    if (event !== "navigate" && event !== "back") return;
    const data = (payload ?? {}) as { path?: string | null };
    const path =
      typeof data.path === "string" && data.path.length > 0 ? data.path : null;
    setRoutes((current) => {
      if (path == null) return current.length === 0 ? current : [];
      if (current[current.length - 1] === path) return current;
      if (current[current.length - 2] === path) return current.slice(0, -1);
      return [...current, path];
    });
  });

  // The host call goes first: it marks the route change before the frame the
  // app renders for it reaches the host, which is what turns the swap into a
  // Cupertino slide instead of an instant cut.
  const push = (path: string) => {
    void navigateTo(path).catch(() => {
      // A preview host without a router still shows the page.
    });
    setRoutes((current) => [...current, path]);
  };

  const back = () => {
    void navigateBack().catch(() => {
      // Same fallback as above.
    });
    setRoutes((current) => current.slice(0, -1));
  };

  const openMovie = (id: string) => push(`/movie/${id}`);
  const openTicket = (code: string) => push(`/ticket/${code}`);
  const openLegal = () => push("/legal");

  if (route && route.startsWith("/movie/")) {
    const id = route.slice("/movie/".length);
    return (
      <MovieScreen
        movieId={id}
        onBack={back}
        onBooked={(code) => {
          setIndex(2);
          openTicket(code);
        }}
      />
    );
  }

  if (route && route.startsWith("/ticket/")) {
    const code = route.slice("/ticket/".length);
    return <TicketScreen code={code} onBack={back} />;
  }

  if (route === "/legal") {
    return <LegalScreen onBack={back} />;
  }

  const tabs: TabItem[] = TABS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    icon: entry.icon,
    badge:
      entry.key === "tickets" && stats.upcoming > 0
        ? String(stats.upcoming)
        : undefined,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {index === 0 ? (
        <DiscoverScreen
          onOpenMovie={openMovie}
          onOpenTicket={openTicket}
          onGoMovies={() => setIndex(1)}
        />
      ) : null}
      {index === 1 ? <MoviesScreen onOpenMovie={openMovie} /> : null}
      {index === 2 ? (
        <TicketsScreen
          onOpenTicket={openTicket}
          onGoMovies={() => setIndex(1)}
        />
      ) : null}
      {index === 3 ? (
        <AccountScreen onOpenMovie={openMovie} onOpenLegal={openLegal} />
      ) : null}

      <TabBar
        tabs={tabs}
        activeIndex={index}
        onChange={(event) => {
          setIndex(event.index);
          setRoutes((current) => (current.length === 0 ? current : []));
        }}
        style={{
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      />
    </View>
  );
}

start(App);
