import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
import 'package:qchat/core/storage/database.dart';
void main(){test('offline outbox survives retry without duplicate client IDs',()async{final db=LocalDatabase.testing(NativeDatabase.memory());final payload={'clientId':'stable-id','conversationId':'conversation','text':'offline'};await db.enqueue(payload);await db.enqueue(payload);expect((await db.pending()).length,1);await db.cache('conversation',[{'sequence':1,'text':'saved'}]);expect((await db.read('conversation'))[0]['text'],'saved');await db.remove('stable-id');expect(await db.pending(),isEmpty);await db.close();});}
