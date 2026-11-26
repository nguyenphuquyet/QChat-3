import { useCallback } from "react";
import { useStudio } from "./store";
import { localeFor, translate } from "./i18n";

export interface I18n {
  /** Translate a message key. Falls back to the Vietnamese string, then the key. */
  t: (
    key: string,
    vars?: Record<string, string | number>,
    fallback?: string,
  ) => string;
  language: ReturnType<typeof useStudio.getState>["settings"]["language"];
  locale: string;
}

export function useI18n(): I18n {
  const language = useStudio((state) => state.settings.language);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>, fallback?: string) =>
      translate(language, key, vars, fallback),
    [language],
  );
  return { t, language, locale: localeFor(language) };
}
