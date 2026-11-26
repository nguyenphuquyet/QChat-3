import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/cupertino.dart' show CupertinoTextField;
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final identifier = TextEditingController(),
      password = TextEditingController(),
      email = TextEditingController(),
      nickname = TextEditingController();
  bool register = false, busy = false;
  String? error;
  @override
  void dispose() {
    for (final c in [identifier, password, email, nickname]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (identifier.text.trim().isEmpty ||
        password.text.length < 12 ||
        (register &&
            (nickname.text.trim().isEmpty || !email.text.contains('@')))) {
      setState(() => error = tr(context, 'password'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(clientProvider)
          .login(
            register
                ? {
                    'qchatId': identifier.text.trim().toLowerCase(),
                    'email': email.text.trim(),
                    'nickname': nickname.text.trim(),
                    'password': password.text,
                  }
                : {
                    'identifier': identifier.text.trim(),
                    'password': password.text,
                  },
            register: register,
          );
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget field(
    BuildContext c,
    TextEditingController controller,
    String label, {
    bool secret = false,
    TextInputType? keyboardType,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: ink(c),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: ink(c).withValues(alpha: .035),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: ink(c).withValues(alpha: .09)),
          ),
          child: CupertinoTextField(
            controller: controller,
            placeholder: secret ? '••••••••••••' : '',
            obscureText: secret,
            keyboardType: keyboardType ?? TextInputType.text,
            cursorColor: QChatColors.green,
            style: TextStyle(fontSize: 16, color: ink(c)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: const BoxDecoration(color: QChatColors.transparent),
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    return QChatPage(
      background: dark ? const Color(0xff171c1a) : const Color(0xfff5f8f6),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(c).bottom),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 24,
                ),
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      for (final language in ['vi', 'en', 'zh'])
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => ref
                                .read(preferencesProvider.notifier)
                                .language(language),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 4,
                              ),
                              child: Text(
                                language == 'zh'
                                    ? '中文'
                                    : language.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight:
                                      ref.watch(preferencesProvider).locale ==
                                          language
                                      ? FontWeight.w700
                                      : FontWeight.w400,
                                  color:
                                      ref.watch(preferencesProvider).locale ==
                                          language
                                      ? QChatColors.green
                                      : QChatColors.muted,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  Text(
                    tr(c, register ? 'authCreateTitle' : 'authWelcomeTitle'),
                    style: TextStyle(
                      fontSize: 32,
                      height: 1.2,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -.8,
                      color: ink(c),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tr(c, register ? 'authCreateNote' : 'welcomeNote'),
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.6,
                      color: QChatColors.muted,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: surface(c),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: ink(c).withValues(alpha: .05)),
                      boxShadow: [
                        BoxShadow(
                          color: QChatColors.black.withValues(
                            alpha: dark ? .08 : .025,
                          ),
                          blurRadius: 32,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ValueListenableBuilder<bool>(
                          valueListenable: ref
                              .read(clientProvider)
                              .sessionExpired,
                          builder: (c, expired, _) => expired
                              ? Padding(
                                  padding: const EdgeInsets.only(bottom: 18),
                                  child: Text(tr(c, 'sessionExpired')),
                                )
                              : const SizedBox.shrink(),
                        ),
                        field(
                          c,
                          identifier,
                          register ? 'QChat ID' : tr(c, 'identifier'),
                        ),
                        if (register) ...[
                          field(
                            c,
                            email,
                            tr(c, 'email'),
                            keyboardType: TextInputType.emailAddress,
                          ),
                          field(c, nickname, tr(c, 'nickname')),
                        ],
                        field(c, password, tr(c, 'password'), secret: true),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 18),
                            child: Text(
                              error!,
                              style: const TextStyle(
                                color: QChatColors.danger,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        const SizedBox(height: 6),
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: busy ? null : submit,
                          child: Container(
                            height: 52,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: QChatColors.green,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: busy
                                ? const SizedBox.square(
                                    dimension: 20,
                                    child: QChatLoading(),
                                  )
                                : Text(
                                    tr(c, register ? 'register' : 'login'),
                                    style: const TextStyle(
                                      color: QChatColors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    tr(c, register ? 'authHasAccount' : 'authNoAccount'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: QChatColors.muted,
                    ),
                  ),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: busy
                        ? null
                        : () => setState(() {
                            register = !register;
                            error = null;
                          }),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        tr(c, register ? 'login' : 'register'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: QChatColors.green,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    tr(c, 'terms'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.6,
                      color: QChatColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
