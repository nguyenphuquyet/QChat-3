import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'miniapp_api.dart';
import 'models.dart';

const _categories = [
  'utilities',
  'social',
  'productivity',
  'entertainment',
  'education',
  'finance',
  'health',
  'shopping',
  'tools',
  'games',
  'news',
  'travel',
];

class MiniAppsScreen extends ConsumerStatefulWidget {
  const MiniAppsScreen({super.key});

  @override
  ConsumerState<MiniAppsScreen> createState() => _MiniAppsScreenState();
}

class _MiniAppsScreenState extends ConsumerState<MiniAppsScreen> {
  final _search = TextEditingController();
  late final MiniAppApi _api = MiniAppApi(ref.read(clientProvider));
  Timer? _debounce;

  String _tab = 'all';
  String _category = '';
  String _query = '';
  int _page = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  MiniAppException? _error;
  List<MiniAppSummary> _items = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (more && (_loadingMore || _items.length >= _total)) return;
    if (!more) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      if (_tab == 'recent' || _tab == 'favorites') {
        final rows = _tab == 'recent'
            ? await _api.recent()
            : await _api.favorites();
        final query = _query.toLowerCase();
        final filtered = rows.where((app) {
          if (_category.isNotEmpty && app.category != _category) return false;
          if (query.isEmpty) return true;
          return app.name.toLowerCase().contains(query) ||
              app.description.toLowerCase().contains(query) ||
              app.developerName.toLowerCase().contains(query);
        }).toList(growable: false);
        if (!mounted) return;
        setState(() {
          _items = filtered;
          _total = filtered.length;
          _loading = false;
          _loadingMore = false;
        });
        return;
      }
      final page = await _api.store(
        query: _query,
        category: _category,
        sort: _tab == 'recommended' ? 'recommended' : 'new',
        page: more ? _page + 1 : 1,
      );
      if (!mounted) return;
      setState(() {
        _page = page.page;
        _total = page.total;
        _items = more ? [..._items, ...page.items] : page.items;
        _loading = false;
        _loadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = MiniAppException.from(error);
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _searchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted || _query == value.trim()) return;
      _query = value.trim();
      unawaited(_load());
    });
  }

  Future<void> _toggleFavorite(MiniAppSummary app) async {
    final next = !app.favorite;
    setState(() {
      _items = _items
          .map((item) => item.appId == app.appId ? item.copyWith(favorite: next) : item)
          .where((item) => _tab != 'favorites' || item.favorite)
          .toList(growable: false);
      if (_tab == 'favorites') _total = _items.length;
    });
    try {
      if (next) {
        await _api.addFavorite(app.appId);
      } else {
        await _api.removeFavorite(app.appId);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = _items
            .map(
              (item) => item.appId == app.appId
                  ? item.copyWith(favorite: !next)
                  : item,
            )
            .toList(growable: false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return QChatPage(
      title: tr(context, 'miniAppsTitle'),
      glassHeader: false,
      leading: QChatIconButton(
        'back',
        label: tr(context, 'back'),
        onTap: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go('/home');
          }
        },
      ),
      trailing: QChatIconButton(
        'refresh',
        label: tr(context, 'miniAppsRefresh'),
        onTap: () => unawaited(_load()),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
            child: QChatTextInput(
              controller: _search,
              hint: tr(context, 'miniAppsSearchHint'),
              onChanged: _searchChanged,
            ),
          ),
          SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _Chip(
                  label: tr(context, 'miniAppsAll'),
                  selected: _category.isEmpty,
                  onTap: () {
                    setState(() => _category = '');
                    unawaited(_load());
                  },
                ),
                for (final category in _categories)
                  _Chip(
                    label: _categoryLabel(category),
                    selected: _category == category,
                    onTap: () {
                      setState(() => _category = _category == category ? '' : category);
                      unawaited(_load());
                    },
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                for (final tab in const [
                  ('all', 'miniAppsAll'),
                  ('recommended', 'miniAppsRecommended'),
                  ('new', 'miniAppsNew'),
                  ('recent', 'miniAppsRecent'),
                  ('favorites', 'miniAppsFavorites'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: _TabButton(
                      label: tr(context, tab.$2),
                      selected: _tab == tab.$1,
                      onTap: () {
                        if (_tab == tab.$1) return;
                        setState(() => _tab = tab.$1);
                        unawaited(_load());
                      },
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(child: _content(context)),
        ],
      ),
    );
  }

  Widget _content(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final error = _error;
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const QChatIcon('miniApps', size: 44, color: QChatColors.muted),
              const SizedBox(height: 12),
              Text(
                tr(context, 'miniAppsError'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              QChatButton(
                tr(context, 'miniAppsRetry'),
                onTap: () => unawaited(_load()),
              ),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const QChatIcon('miniApps', size: 44, color: QChatColors.muted),
              const SizedBox(height: 12),
              Text(
                _query.isEmpty && _category.isEmpty
                    ? tr(context, 'miniAppsEmpty')
                    : tr(context, 'miniAppsNoResults'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: QChatColors.muted),
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
        itemCount: _items.length + (_items.length < _total ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _items.length) {
            if (!_loadingMore) {
              unawaited(_load(more: true));
            }
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final app = _items[index];
          return _AppCard(
            app: app,
            onOpen: () => context.push('/miniApps/${app.appId}'),
            onFavorite: () => unawaited(_toggleFavorite(app)),
          );
        },
      ),
    );
  }
}

String _categoryLabel(String category) =>
    category.isEmpty ? category : '${category[0].toUpperCase()}${category.substring(1)}';

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6, bottom: 6, top: 2),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? QChatColors.green.withValues(alpha: .12)
                : surface(context),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? QChatColors.green
                  : Theme.of(context).dividerColor.withValues(alpha: .4),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              color: selected ? QChatColors.green : ink(context),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              width: 2,
              color: selected ? QChatColors.green : Colors.transparent,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: selected ? QChatColors.green : QChatColors.muted,
          ),
        ),
      ),
    );
  }
}

class _AppCard extends StatelessWidget {
  const _AppCard({
    required this.app,
    required this.onOpen,
    required this.onFavorite,
  });

  final MiniAppSummary app;
  final VoidCallback onOpen;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: surface(context),
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 6, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _AppIcon(app: app),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              app.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (app.currentVersion != null)
                            Text(
                              'v${app.currentVersion}',
                              style: const TextStyle(
                                fontSize: 10,
                                color: QChatColors.muted,
                              ),
                            ),
                        ],
                      ),
                      if (app.description.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          app.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: QChatColors.muted,
                          ),
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        [
                          if (app.developerName.isNotEmpty)
                            '${tr(context, 'miniAppsBy')} ${app.developerName}',
                          _categoryLabel(app.category),
                          if (app.openCount > 0) '${app.openCount}',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: QChatColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: tr(
                    context,
                    app.favorite ? 'miniAppsUnfavorite' : 'miniAppsFavorite',
                  ),
                  onPressed: onFavorite,
                  icon: QChatIcon(
                    'star',
                    filled: app.favorite,
                    size: 21,
                    color: app.favorite
                        ? const Color(0xffe0a500)
                        : QChatColors.muted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AppIcon extends StatelessWidget {
  const _AppIcon({required this.app});

  final MiniAppSummary app;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: QChatColors.green.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Text(
        app.name.isEmpty ? '?' : app.name.characters.first.toUpperCase(),
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: QChatColors.green,
        ),
      ),
    );
    if (app.iconUrl.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Image.network(
        app.iconUrl,
        width: 48,
        height: 48,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}
