# QuickJS for the QChat Mini App service runtime (ADR 017).
#
# The upstream release is vendored under quickjs/ (MIT, see quickjs/LICENSE and
# quickjs/VENDORED.md). Fetching the tarball at configure time would make every
# ABI configuration depend on bellard.org; vendoring also keeps offline builds
# and CI reproducible.
#
# Only the interpreter sources are compiled. qjs.c, qjsc.c, run-test262.c and
# quickjs-libc.c are the command-line tools and the POSIX libc layer; the
# service runtime does not expose either.

cmake_minimum_required(VERSION 3.22)

project(qchat_quickjs C)

set(QJS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/quickjs")

if(NOT EXISTS "${QJS_ROOT}/quickjs.c")
    message(FATAL_ERROR "The vendored QuickJS sources are missing at ${QJS_ROOT}.")
endif()

add_library(qchat_quickjs SHARED
    qjs_jni.c
    "${QJS_ROOT}/quickjs.c"
    "${QJS_ROOT}/dtoa.c"
    "${QJS_ROOT}/libregexp.c"
    "${QJS_ROOT}/libunicode.c"
    "${QJS_ROOT}/cutils.c")

target_include_directories(qchat_quickjs PRIVATE "${QJS_ROOT}")

# The upstream Makefile defines the same two macros; CONFIG_VERSION is what the
# memory-usage dump reports.
target_compile_definitions(qchat_quickjs PRIVATE
    _GNU_SOURCE
    CONFIG_VERSION="2026-06-04")

# -fwrapv matches upstream: QuickJS relies on two's-complement overflow.
target_compile_options(qchat_quickjs PRIVATE
    -fwrapv
    -Wno-unused-parameter
    -Wno-sign-compare)

target_link_libraries(qchat_quickjs PRIVATE log m)
