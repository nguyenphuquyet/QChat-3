import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:qchat_miniapp_webview/qchat_miniapp_webview.dart';

/// The spike package: one page, no assets, no service code.
///
/// This is deliberately **not** the installer. It has no signature, no archive
/// and no rollback; it exists so the host can be exercised on a real phone or
/// simulator before the signed installer and the service runtime are wired into
/// a compiled Mini App. The screen that opens it says so.
const miniAppSpikeAppId = 'com.qchat.spike';
const miniAppSpikeVersion = '1.0.0';
const miniAppSpikeRoute = 'pages/spike/index';

/// The page stylesheet the host injects before `__qchatView.start`.
///
/// The view client sets `data-theme` and `color-scheme` on the page root, so the
/// page follows the app's light/dark choice without a second stylesheet.
const _spikeCss = '''
:root{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#ffffff;color:#111111}
:root[data-theme="dark"]{background:#111111;color:#f2f2f2}
body{margin:0}
.page{display:block;padding:20px}
.card{display:block;padding:20px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:rgba(0,0,0,.02)}
:root[data-theme="dark"] .card{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
.badge{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#07c160}
.title{display:block;margin:10px 0 8px;font-size:22px;font-weight:600}
.body{display:block;margin-top:8px;font-size:14px;line-height:1.5;color:#666666}
:root[data-theme="dark"] .body{color:#a0a0a0}
.action{display:inline-block;margin-top:18px}
''';

/// Write the spike page into the installed layout and return the version
/// directory.
///
/// The path comes from the host (`qchat/miniapp/installer`), so the installer
/// and the WebView can never disagree about where a version lives.
Future<String> installMiniAppSpike() async {
  final versionDir = await MiniAppInstallPaths.versionDir(
    appId: miniAppSpikeAppId,
    version: miniAppSpikeVersion,
  );
  final bundle = File(p.join(versionDir, 'build', 'view.json'));
  await bundle.parent.create(recursive: true);

  final json = <String, Object?>{
    'format': 'qchat-view-bundle',
    'formatVersion': 1,
    'appCss': '',
    'pages': <String, Object?>{
      miniAppSpikeRoute: <String, Object?>{
        'css': _spikeCss,
        'config': <String, Object?>{},
      },
    },
    'components': <String, Object?>{},
  };
  await bundle.writeAsString(jsonEncode(json), flush: true);
  return versionDir;
}

/// The one page tree the spike renders, with the tap counter it shows.
Map<String, Object?> miniAppSpikeTree({required int taps}) => <String, Object?>{
  'type': 'element',
  'tag': 'wx-view',
  'props': <String, Object?>{'class': 'page'},
  'children': <Object?>[
    <String, Object?>{
      'type': 'element',
      'tag': 'wx-view',
      'props': <String, Object?>{'class': 'card'},
      'children': <Object?>[
        <String, Object?>{
          'type': 'element',
          'tag': 'wx-view',
          'props': <String, Object?>{'class': 'badge'},
          'children': <Object?>[
            <String, Object?>{'type': 'text', 'text': 'QChat WebView host'},
          ],
        },
        <String, Object?>{
          'type': 'element',
          'tag': 'wx-text',
          'props': <String, Object?>{'class': 'title'},
          'children': <Object?>[
            <String, Object?>{
              'type': 'text',
              'text': 'Hello from the installed page',
            },
          ],
        },
        <String, Object?>{
          'type': 'element',
          'tag': 'wx-text',
          'props': <String, Object?>{'class': 'body'},
          'children': <Object?>[
            <String, Object?>{
              'type': 'text',
              'text':
                  'This tree arrived as a view.render bridge event. The '
                  'document comes from the app-private origin, and the '
                  'service code is never served to it.',
            },
          ],
        },
        <String, Object?>{
          'type': 'element',
          'tag': 'wx-text',
          'props': <String, Object?>{'class': 'body'},
          'children': <Object?>[
            <String, Object?>{'type': 'text', 'text': 'Taps received: $taps'},
          ],
        },
        <String, Object?>{
          'type': 'element',
          'tag': 'wx-button',
          'props': <String, Object?>{'class': 'action', 'type': 'primary'},
          'events': <String, Object?>{
            'tap': <String, Object?>{'handler': 'onSpikeTap'},
          },
          'children': <Object?>[
            <String, Object?>{'type': 'text', 'text': 'Send a tap back'},
          ],
        },
      ],
    },
  ],
};

/// One `view.render` bridge event carrying the whole spike tree.
///
/// A full tree is used instead of path ops on purpose: the spike has no
/// renderer diffing, and a tree is the simplest payload the view client accepts.
String miniAppSpikeRender({
  required String appId,
  required String sessionId,
  required String pageId,
  required String theme,
  required int seq,
  required int taps,
}) => jsonEncode(<String, Object?>{
  'v': 1,
  'kind': 'event',
  'appId': appId,
  'sessionId': sessionId,
  'pageId': pageId,
  'event': 'view.render',
  'payload': <String, Object?>{
    'pageId': pageId,
    'seq': seq,
    'update': <String, Object?>{
      'kind': 'tree',
      'theme': theme,
      'tree': miniAppSpikeTree(taps: taps),
    },
  },
});
