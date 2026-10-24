import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/qchat_animations.dart';
import '../../core/design_system/qchat_shadows.dart';
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

/// Tabs that browse the public store; the personal tabs hide the category
/// filter so the header stays short.
const _storeTabs = ['all', 'recommended', 'new'];

const _appTints = [
  Color(0xff07c160),
  Color(0xff168fe5),
  Color(0xfff5a33a),
  Color(0xffef6269),
  Color(0xff7970da),
  Color(0xff16b8bb),
];

/// Tint used while a card is held down; the app avoids ripples, so the press
/// is shown by darkening the surface instead.
Color _pressedSurface(BuildContext c) =>
    Theme.of(c).brightness == Brightness.dark
    ? const Color(0xff262626)
    : const Color(0xfff2f2f2);

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

  bool get _isStoreTab => _storeTabs.contains(_tab);

  /// The first three results of a store tab, shown as a highlight strip. The
  /// strip only appears once the page has enough entries to make it read as a
  /// selection instead of a duplicate of the list below.
  List<MiniAppSummary> get _featured => _isStoreTab &&
          _query.isEmpty &&
          _category.isEmpty &&
          _items.length >= 6
      ? _items.take(3).toList(growable: false)
      : const [];

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

  void _selectTab(String tab) {
    if (_tab == tab) return;
    setState(() {
      _tab = tab;
      // The filter row is hidden on the personal tabs, so drop any category
      // that would otherwise keep filtering them silently.
      if (!_storeTabs.contains(tab)) _category = '';
    });
    unawaited(_load());
  }

  void _selectCategory(String category) {
    setState(() => _category = _category == category ? '' : category);
    unawaited(_load());
  }

  Future<void> _toggleFavorite(MiniAppSummary app) async {
    final next = !app.favorite;
    setState(() {
      _items = _items
          .map(
            (item) =>
                item.appId == app.appId ? item.copyWith(favorite: next) : item,
          )
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

  void _open(MiniAppSummary app) => context.push('/miniApps/${app.appId}');

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
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: QChatTextInput(
              controller: _search,
              hint: tr(context, 'miniAppsSearchHint'),
              onChanged: _searchChanged,
            ),
          ),
          _tabBar(context),
          if (_isStoreTab) _categoryBar(context),
          Container(
            height: .5,
            color: ink(context).withValues(alpha: .07),
          ),
          Expanded(child: _content(context)),
        ],
      ),
    );
  }

  Widget _tabBar(BuildContext c) => SizedBox(
    height: 43,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      children: [
        for (final tab in const [
          ('all', 'miniAppsAll'),
          ('recommended', 'miniAppsRecommended'),
          ('new', 'miniAppsNew'),
          ('recent', 'miniAppsRecent'),
          ('favorites', 'miniAppsFavorites'),
        ])
          _TabButton(
            label: tr(c, tab.$2),
            selected: _tab == tab.$1,
            onTap: () => _selectTab(tab.$1),
          ),
      ],
    ),
  );

  Widget _categoryBar(BuildContext c) => SizedBox(
    height: 40,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
      children: [
        _CategoryChip(
          label: tr(c, 'miniAppsAll'),
          selected: _category.isEmpty,
          onTap: () => _selectCategory(''),
        ),
        for (final category in _categories)
          _CategoryChip(
            label: _categoryLabel(c, category),
            selected: _category == category,
            onTap: () => _selectCategory(category),
          ),
      ],
    ),
  );

  Widget _content(BuildContext c) {
    if (_loading) return const _StoreSkeleton();
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const QChatIcon('miniApps', size: 46, color: QChatColors.muted),
              const SizedBox(height: 16),
              Text(
                tr(c, 'miniAppsError'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: ink(c),
                ),
              ),
              const SizedBox(height: 18),
              QChatButton(tr(c, 'miniAppsRetry'), onTap: () => unawaited(_load())),
            ],
          ),
        ),
      );
    }
    if (_items.isEmpty) {
      return QChatEmptyState(
        _query.isEmpty && _category.isEmpty
            ? tr(c, 'miniAppsEmpty')
            : tr(c, 'miniAppsNoResults'),
        icon: 'miniApps',
      );
    }
    final featured = _featured;
    // Highlighted entries move to the rail, so the list keeps only the rest
    // and the two sections never repeat the same app.
    final highlightIds = featured.map((app) => app.appId).toSet();
    final listItems = featured.isEmpty
        ? _items
        : _items
              .where((app) => !highlightIds.contains(app.appId))
              .toList(growable: false);
    final more = _items.length < _total;
    final count = featured.isEmpty ? _total : _total - featured.length;
    return RefreshIndicator(
      onRefresh: () => _load(),
      color: QChatColors.green,
      backgroundColor: surface(c),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (featured.isNotEmpty)
            SliverToBoxAdapter(
              child: _FeaturedStrip(apps: featured, onOpen: _open),
            ),
          SliverToBoxAdapter(
            child: _SectionHeader(
              title: featured.isEmpty ? _tabLabel(c) : tr(c, 'miniAppsMore'),
              count: tr(
                c,
                'miniAppsCount',
              ).replaceAll('{n}', '${count < 0 ? 0 : count}'),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            sliver: SliverList.builder(
              itemCount: listItems.length + (more ? 1 : 0),
              itemBuilder: (context, index) {
                if (index >= listItems.length) {
                  if (!_loadingMore) unawaited(_load(more: true));
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18),
                    child: QChatLoading(),
                  );
                }
                final app = listItems[index];
                return _AppCard(
                  app: app,
                  onOpen: () => _open(app),
                  onFavorite: () => unawaited(_toggleFavorite(app)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _tabLabel(BuildContext c) => tr(
    c,
    switch (_tab) {
      'recommended' => 'miniAppsRecommended',
      'new' => 'miniAppsNew',
      'recent' => 'miniAppsRecent',
      'favorites' => 'miniAppsFavorites',
      _ => 'miniAppsAll',
    },
  );
}

/// Localized category name, falling back to the raw value when the store
/// introduces a category this build does not translate yet.
String _categoryLabel(BuildContext c, String category) {
  if (category.isEmpty) return '';
  final key = 'miniAppsCat${category[0].toUpperCase()}${category.substring(1)}';
  final label = tr(c, key);
  return label == key
      ? '${category[0].toUpperCase()}${category.substring(1)}'
      : label;
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
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                height: 1.1,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                color: selected ? ink(context) : QChatColors.muted,
              ),
            ),
            const SizedBox(height: 6),
            AnimatedContainer(
              duration: qchatDuration(context),
              width: selected ? 18 : 0,
              height: 3,
              decoration: BoxDecoration(
                color: QChatColors.green,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
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
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: qchatDuration(context),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? QChatColors.green.withValues(alpha: .12)
                : surface(context),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected
                  ? QChatColors.green.withValues(alpha: .55)
                  : ink(context).withValues(alpha: .08),
              width: .5,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.1,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              color: selected ? QChatColors.green : QChatColors.muted,
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.count = ''});

  final String title;
  final String count;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w600,
            color: ink(context),
          ),
        ),
        const Spacer(),
        if (count.isNotEmpty)
          Text(
            count,
            style: const TextStyle(fontSize: 11.5, color: QChatColors.muted),
          ),
      ],
    ),
  );
}

/// Horizontal highlight rail above the list. The rail has a fixed height, so
/// text scaling is clamped to keep the cards from overflowing.
class _FeaturedStrip extends StatelessWidget {
  const _FeaturedStrip({required this.apps, required this.onOpen});

  final List<MiniAppSummary> apps;
  final ValueChanged<MiniAppSummary> onOpen;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionHeader(title: tr(context, 'miniAppsFeatured')),
      SizedBox(
        height: 124,
        child: MediaQuery.withClampedTextScaling(
          maxScaleFactor: 1.25,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: apps.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (_, index) => _FeaturedCard(
              app: apps[index],
              onTap: () => onOpen(apps[index]),
            ),
          ),
        ),
      ),
    ],
  );
}

class _FeaturedCard extends StatefulWidget {
  const _FeaturedCard({required this.app, required this.onTap});

  final MiniAppSummary app;
  final VoidCallback onTap;

  @override
  State<_FeaturedCard> createState() => _FeaturedCardState();
}

class _FeaturedCardState extends State<_FeaturedCard> {
  bool _pressed = false;

  void _press(bool value) {
    if (_pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: qchatDuration(context),
          width: 244,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _pressed
                ? _pressedSurface(context)
                : surface(context),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: ink(context).withValues(alpha: .06),
              width: .5,
            ),
            boxShadow: QChatShadows.overlay,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _AppIcon(app: app, size: 50),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: ink(context),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      app.description.isEmpty
                          ? _categoryLabel(context, app.category)
                          : app.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: QChatColors.muted,
                      ),
                    ),
                    const Spacer(),
                    _AppMeta(app: app, showDeveloper: false),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppCard extends StatefulWidget {
  const _AppCard({
    required this.app,
    required this.onOpen,
    required this.onFavorite,
  });

  final MiniAppSummary app;
  final VoidCallback onOpen;
  final VoidCallback onFavorite;

  @override
  State<_AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<_AppCard> {
  bool _pressed = false;

  void _press(bool value) {
    if (_pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: _pressed ? _pressedSurface(context) : surface(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: ink(context).withValues(alpha: .06),
          width: .5,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onOpen,
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
                    Text(
                      app.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15.5,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: ink(context),
                      ),
                    ),
                    if (app.description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        app.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: QChatColors.muted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    _AppMeta(app: app),
                  ],
                ),
              ),
              _FavoriteButton(
                favorite: app.favorite,
                label: tr(
                  context,
                  app.favorite ? 'miniAppsUnfavorite' : 'miniAppsFavorite',
                ),
                onTap: widget.onFavorite,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Category pill, version and usage count, with the developer pushed to the
/// trailing edge so long names truncate instead of wrapping.
class _AppMeta extends StatelessWidget {
  const _AppMeta({required this.app, this.showDeveloper = true});

  final MiniAppSummary app;
  final bool showDeveloper;

  @override
  Widget build(BuildContext context) {
    final label = _categoryLabel(context, app.category);
    return Row(
      children: [
        if (label.isNotEmpty)
          Flexible(child: _CategoryPill(label: label)),
        if (app.currentVersion != null) ...[
          const SizedBox(width: 8),
          Text(
            'v${app.currentVersion}',
            style: const TextStyle(fontSize: 10.5, color: QChatColors.muted),
          ),
        ],
        if (app.openCount > 0) ...[
          const SizedBox(width: 10),
          const QChatIcon('eye', size: 13, color: QChatColors.muted),
          const SizedBox(width: 3),
          Text(
            '${app.openCount}',
            style: const TextStyle(fontSize: 10.5, color: QChatColors.muted),
          ),
        ],
        if (showDeveloper && app.developerName.isNotEmpty) ...[
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${tr(context, 'miniAppsBy')} ${app.developerName}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 10.5, color: QChatColors.muted),
            ),
          ),
        ],
      ],
    );
  }
}

class _CategoryPill extends StatelessWidget {
  const _CategoryPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
    decoration: BoxDecoration(
      color: QChatColors.green.withValues(alpha: .11),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(
        fontSize: 10.5,
        height: 1.25,
        fontWeight: FontWeight.w500,
        color: QChatColors.green,
      ),
    ),
  );
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({
    required this.favorite,
    required this.label,
    required this.onTap,
  });

  final bool favorite;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: favorite,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: 40,
        height: 40,
        child: Center(
          child: QChatIcon(
            'star',
            filled: favorite,
            size: 20,
            color: favorite ? const Color(0xffe0a500) : QChatColors.muted,
          ),
        ),
      ),
    ),
  );
}

class _AppIcon extends StatelessWidget {
  const _AppIcon({required this.app, this.size = 52});

  final MiniAppSummary app;
  final double size;

  /// Stable per-app tint so icon-less entries stay distinguishable instead of
  /// repeating the same green square.
  Color get _tint {
    var hash = 7;
    for (final unit in '${app.appId}${app.name}'.codeUnits) {
      hash = (hash * 31 + unit) & 0x7fffffff;
    }
    return _appTints[hash % _appTints.length];
  }

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * .25);
    final base = _tint;
    final hsl = HSLColor.fromColor(base);
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            base,
            hsl.withLightness((hsl.lightness - .09).clamp(0.0, 1.0)).toColor(),
          ],
        ),
        borderRadius: radius,
      ),
      child: Text(
        app.name.isEmpty ? '?' : app.name.characters.first.toUpperCase(),
        style: TextStyle(
          fontSize: size * .4,
          height: 1,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
    if (app.iconUrl.isEmpty) return fallback;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: radius,
        border: Border.all(
          color: ink(context).withValues(alpha: .06),
          width: .5,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.network(
        app.iconUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

/// Placeholder cards shown while the first page loads, so the page keeps its
/// shape instead of flashing a spinner.
class _StoreSkeleton extends StatelessWidget {
  const _StoreSkeleton();

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(12, 16, 12, 24),
    physics: const NeverScrollableScrollPhysics(),
    children: const [
      _SkeletonCard(),
      _SkeletonCard(),
      _SkeletonCard(),
      _SkeletonCard(),
    ],
  );
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final block = ink(context).withValues(alpha: .06);
    final faint = ink(context).withValues(alpha: .04);
    Widget bar(double width, double height) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: block,
        borderRadius: BorderRadius.circular(4),
      ),
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: surface(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: faint, width: .5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: block,
              borderRadius: BorderRadius.circular(13),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                bar(148, 12),
                const SizedBox(height: 9),
                bar(double.infinity, 10),
                const SizedBox(height: 6),
                bar(172, 10),
                const SizedBox(height: 12),
                Row(
                  children: [
                    bar(62, 14),
                    const SizedBox(width: 8),
                    bar(38, 10),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
