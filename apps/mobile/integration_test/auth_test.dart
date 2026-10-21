import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:qchat/main.dart' as app;
void main(){IntegrationTestWidgetsFlutterBinding.ensureInitialized();testWidgets('switch language and registration form', (tester)async{app.main();await tester.pumpAndSettle();await tester.tap(find.text('EN'));await tester.pumpAndSettle();expect(find.text('Log in'),findsOneWidget);await tester.tap(find.text('Create account'));await tester.pumpAndSettle();expect(find.text('Display name'),findsOneWidget);expect(find.text('Email'),findsOneWidget);});}
