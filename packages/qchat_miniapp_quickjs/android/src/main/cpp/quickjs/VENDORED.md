# Vendored QuickJS

- **Upstream:** `https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz`
- **Version:** `2026-06-04` (see `VERSION`)
- **SHA-256 of the tarball:** `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`
- **License:** MIT (`LICENSE`)
- **Decision:** ADR 009 (engine choice) and ADR 017 (build and JNI boundary)

The tarball is copied as-is. Nothing in this directory is patched, so a future
update is a straight replacement of the same file list, followed by
`pnpm typecheck` and a CI build of the three ABIs.

Files taken from the tarball:

```
quickjs.c  quickjs.h  quickjs-atom.h  quickjs-opcode.h
dtoa.c     dtoa.h
libregexp.c  libregexp.h  libregexp-opcode.h
libunicode.c  libunicode.h  libunicode-table.h
cutils.c   cutils.h  list.h
LICENSE  VERSION  readme.txt  Changelog
```

Not taken: `qjs.c`, `qjsc.c`, `run-test262.c`, `quickjs-libc.c` and the test262
material. They are the CLI tools, the POSIX libc layer and the conformance
suite; the service runtime exposes only `JS_NewRuntime`, `JS_NewContext`,
`JS_Eval` and the limit/interrupt hooks through `qjs_jni.c`.
