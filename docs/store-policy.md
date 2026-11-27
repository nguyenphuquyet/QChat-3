# Store policy analysis (M0)

- **Date:** 2026-11-27
- **Scope:** Google Play (Android) and Apple App Store (iOS) rules that affect a
  host app which downloads and runs Mini Apps written in JavaScript, renders
  them in the system WebView, and exposes native APIs through a bridge.
- **Method:** official policy pages fetched on 2026-11-27. Only rules actually
  read are cited. Items that could not be verified are marked `UNVERIFIED`.
- **Repeat:** before any distribution (section 10).

## 1. Google Play

### 1.1 Sources read

- *Device and Network Abuse*, Play Console Help,
  `https://support.google.com/googleplay/android-developer/answer/9888379?hl=en`,
  retrieved 2026-11-27.

### 1.2 Rules that apply (quoted from the page)

1. "An app distributed via Google Play may not modify, replace, or update itself
   using any method other than Google Play's update mechanism. Likewise, an app
   may not download executable code (such as dex, JAR, .so files) from a source
   other than Google Play. **This restriction does not apply to code that runs
   in a virtual machine or an interpreter where either provides indirect access
   to Android APIs (such as JavaScript in a webview or browser).**"
2. "Apps or third-party code, like SDKs, with interpreted languages (JavaScript,
   Python, Lua, etc.) loaded at run time (for example, not packaged with the
   app) **must not allow potential violations of Google Play policies.**"
3. Examples of violations include "Apps or third party code (for example, SDKs)
   containing a webview with added JavaScript Interface that loads untrusted web
   content (for example, http:// URL) or unverified URLs obtained from untrusted
   sources".

### 1.3 Conclusion

The architecture is **allowed** on Google Play: Mini App code is interpreted
JavaScript in the system WebView, not downloaded native executable code. Two
obligations follow:

- The host must prevent Mini Apps from enabling policy violations (illegal
  content, malware, deceptive behaviour, payment evasion). This is enforced by
  automated package validation, the domain allowlist, the API allowlist, the
  absence of arbitrary native access, telemetry and operator revocation.
- The bridge must not be an `addJavascriptInterface` channel over untrusted
  content. Section 4.3 already requires `addWebMessageListener`/`WebMessagePort`
  with an allowed origin; ADR 002 implements it. This is both a security and a
  policy requirement.

`UNVERIFIED`: whether Google Play treats a general-purpose Mini App host as a
separate category with additional review requirements. No such rule was found on
the page read; the "Apps that host other apps" question is checked again before
distribution, and a Play Console policy contact is the fallback.

### 1.4 Risks and mitigations

| Risk | Mitigation |
|---|---|
| A Mini App distributes prohibited content | Automated validation, domain allowlist, report/block, operator suspend/revoke (section 14) |
| A Mini App abuses a native API | Per-app permissions, OS permissions, allowlisted APIs, audit logs |
| WebView JS interface over untrusted content | `addWebMessageListener` with allowed origin; no `addJavascriptInterface` (ADR 002) |
| Self-update accusation | Only Mini App packages are downloaded, never native code; the host updates through Play |
| Data safety declaration | Document what the host and Mini Apps collect; no secrets in logs (section 10) |

## 2. Apple App Store

### 2.1 Sources read

- *App Store Review Guidelines*,
  `https://developer.apple.com/app-store/review/guidelines/`, retrieved
  2026-11-27.

### 2.2 Rules that apply (quoted)

- **2.5.2:** "Apps should be self-contained in their bundles, and may not read or
  write data outside the designated container area, nor may they download,
  install, or execute code which introduces or changes features or functionality
  of the app, including other apps."
- **4.7:** "Apps may offer certain software that is not embedded in the binary,
  specifically HTML5 and JavaScript mini apps and mini games, streaming games,
  chatbots, and plug-ins. … You are responsible for all such software offered in
  your app, including ensuring that such software complies with these Guidelines
  and all applicable laws."
- **4.7.1:** the software must follow the privacy guidelines, include content
  filtering, reporting and blocking, and follow Guideline 3.1 for digital goods.
- **4.7.2:** "Your app may not extend or expose native platform APIs or
  technologies to the software without prior permission from Apple."
- **4.7.3:** no sharing of data or privacy permissions with the software without
  explicit user consent in each instance.
- **4.7.4:** "You must provide an index of software and metadata available in
  your app. It must include universal links that lead to all of the software
  offered in your app."
- **4.7.5:** the app must identify software that exceeds the app's age rating
  and use an age restriction mechanism.
- **4.8:** apps using a third-party or social login service (the list names
  WeChat Login) must also offer an equivalent login option with limited data
  collection. We do not use WeChat Login (`wx.login` is `Unsupported`), so this
  applies only if a QChat login design later adopts a social provider.

### 2.3 Conclusion

HTML5/JavaScript Mini Apps are **permitted under 4.7**, not under the general
2.5.2 ban. The design is therefore viable on iOS, but 4.7 imposes four
obligations that are product work, not just engineering:

1. **4.7.2 is the largest risk.** `wx.chooseImage`, `wx.scanCode`,
   `wx.getLocation`, clipboard and similar APIs expose native platform
   capabilities. Apple requires **prior permission**. Mitigations, in order:
   - prefer web-platform capabilities (`<input type=file>`, `getUserMedia`,
     Geolocation API) that the WebView already mediates and the user can deny;
   - keep native API exposure to the minimum the sample apps need;
   - prepare an Apple justification/permission request before M8, listing each
     API, why a web API is insufficient, and the consent UI;
   - if permission is refused, ship the iOS build with those APIs reported as
     `Unsupported` (documented error), not silently disabled.
2. **4.7.1 content duties:** report/block, objectionable-content filtering, and
   Guideline 3.1 for digital goods. Payment is out of scope, so the platform
   must reject apps that try to sell digital goods outside the rules.
3. **4.7.4 index:** the Developer Center/store must expose an index of apps with
   universal links. The QChat store screens can satisfy this; the backend must
   provide stable links.
4. **4.7.5 age rating:** per-app age metadata and an age gate.

### 2.4 Risks and mitigations

| Risk | Mitigation |
|---|---|
| 4.7.2 rejection for native API exposure | Minimise native APIs, request Apple permission before M8, document web-API alternatives, `Unsupported` fallback |
| 4.7.1 content/age duties | Per-app age rating, report/block, operator revocation, no payment |
| 4.7.4 missing index | Store index with universal links (M9/M11) |
| 4.7.3 permission sharing | Per-app, per-instance consent; no silent inheritance of host permissions |
| 2.5.6 WebKit requirement | iOS uses WKWebView only; no alternative engine |
| Review of downloaded code | 4.7 is the explicit exception; keep the package and version metadata available for review |

## 3. Decisions and open items

- **No ADR waives a store rule.** The mitigation choices above are product
  decisions recorded here; the Apple permission step is a release gate for M8.
- **Open:** the Apple permission request text and the exact API list are written
  in M8, after the API registry is frozen in M7.
- **Open:** confirm Google Play's position on a Mini App host before the first
  Play upload (M11), using the Play Console policy contact.
- **Cost:** no paid service is required for either analysis; both pages are
  public.

## 4. What this means for the phases

| Phase | Store-policy work |
|---|---|
| M1–M6 | Build the allowlists, permissions, validation and reporting that the policies require |
| M7 | Freeze the `wx.*` surface; mark each API's web alternative and native exposure |
| M8 | Apple permission request, age metadata, index links, iOS review checklist |
| M11 | Re-check both policies, prepare the Play/App Store submissions, keep the evidence |
