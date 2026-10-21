import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
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

  @override
  Widget build(BuildContext c) => QChatPage(
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 36),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                for (final language in ['vi', 'en', 'zh'])
                  Padding(
                    padding: const EdgeInsets.only(left: 10),
                    child: GestureDetector(
                      onTap: () => ref
                          .read(preferencesProvider.notifier)
                          .language(language),
                      child: Text(
                        language == 'vi'
                            ? 'VI'
                            : language == 'en'
                            ? 'EN'
                            : '中文',
                        style: TextStyle(
                          color:
                              ref.watch(preferencesProvider).locale == language
                              ? QChatColors.green
                              : QChatColors.muted,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 42),
            Center(
              child: Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: QChatColors.green,
                  borderRadius: BorderRadius.circular(19),
                ),
                child: const Center(
                  child: Text(
                    'Q',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'QChat',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w600,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              tr(c, 'welcome'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              tr(c, 'welcomeNote'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: QChatColors.muted),
            ),
            const SizedBox(height: 40),
            QChatTextInput(
              controller: identifier,
              hint: register ? 'QChat ID' : tr(c, 'identifier'),
            ),
            const SizedBox(height: 12),
            if (register) ...[
              QChatTextInput(controller: email, hint: tr(c, 'email')),
              const SizedBox(height: 12),
              QChatTextInput(controller: nickname, hint: tr(c, 'nickname')),
              const SizedBox(height: 12),
            ],
            QChatTextInput(
              controller: password,
              hint: tr(c, 'password'),
              secret: true,
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  error!,
                  style: const TextStyle(
                    color: QChatColors.danger,
                    fontSize: 13,
                  ),
                ),
              ),
            const SizedBox(height: 24),
            QChatButton(
              tr(
                c,
                busy
                    ? 'loading'
                    : register
                    ? 'register'
                    : 'login',
              ),
              onTap: busy ? null : submit,
            ),
            const SizedBox(height: 12),
            QChatButton(
              tr(c, register ? 'login' : 'register'),
              secondary: true,
              onTap: busy
                  ? null
                  : () => setState(() {
                      register = !register;
                      error = null;
                    }),
            ),
            const SizedBox(height: 40),
            Text(
              tr(c, 'terms'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                color: QChatColors.muted,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
