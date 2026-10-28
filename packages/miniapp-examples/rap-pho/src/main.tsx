import "@mna/qchat/env/auto";

import { navigateTo, start, useEffect, useLifecycle, useState } from "@mna/qchat";
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
  const [route, setRoute] = useState<string | null>(null);
  const tickets = useTickets();
  const stats = ticketStats(tickets);

  useEffect(() => {
    void hydrate();
  }, []);

  // The host owns the route stack. It reports every push and pop, and the app
  // only decides which screen that path means.
  useLifecycle((event, payload) => {
    if (event === "navigate") {
      const data = (payload ?? {}) as { path?: string | null };
      setRoute(typeof data.path === "string" ? data.path : null);
      return;
    }
    if (event === "back") {
      const data = (payload ?? {}) as { path?: string | null };
      setRoute(
        typeof data.path === "string" && data.path.length > 0
          ? data.path
          : null,
      );
    }
  });

  const openMovie = (id: string) => {
    setRoute(`/movie/${id}`);
    void navigateTo(`/movie/${id}`).catch(() => {
      // A preview host without a router still shows the page.
    });
  };

  const openTicket = (code: string) => {
    setRoute(`/ticket/${code}`);
    void navigateTo(`/ticket/${code}`).catch(() => {
      // Same fallback as above.
    });
  };

  const openLegal = () => {
    setRoute("/legal");
    void navigateTo("/legal").catch(() => {
      // Same fallback as above.
    });
  };

  if (route && route.startsWith("/movie/")) {
    const id = route.slice("/movie/".length);
    return (
      <MovieScreen
        movieId={id}
        onBack={() => setRoute(null)}
        onBooked={(code) => {
          setIndex(2);
          openTicket(code);
        }}
      />
    );
  }

  if (route && route.startsWith("/ticket/")) {
    const code = route.slice("/ticket/".length);
    return <TicketScreen code={code} onBack={() => setRoute(null)} />;
  }

  if (route === "/legal") {
    return <LegalScreen onBack={() => setRoute(null)} />;
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
          setRoute(null);
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
