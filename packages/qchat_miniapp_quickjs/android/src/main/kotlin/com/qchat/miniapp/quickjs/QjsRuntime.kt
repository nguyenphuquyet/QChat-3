package com.qchat.miniapp.quickjs

import java.io.Closeable
import java.util.concurrent.Callable
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * One QuickJS runtime and the single thread that owns it.
 *
 * QuickJS is not thread safe: a `JSRuntime` must be created, evaluated and
 * freed on the same thread. Every call here is submitted to [executor], so the
 * Dart side may call from any isolate while the native runtime stays serial.
 *
 * The limits are deliberate (ADR 017): a Mini App gets 64 MiB of heap, a 1 MiB
 * stack and a two-second default evaluation budget. A script that exceeds the
 * budget is interrupted by `JS_SetInterruptHandler`, not by killing a thread.
 */
class QjsRuntime(
    memoryLimitBytes: Long = DEFAULT_MEMORY_LIMIT_BYTES,
    stackSizeBytes: Long = DEFAULT_STACK_SIZE_BYTES,
) : Closeable {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor { task ->
        Thread(task, "qchat-qjs").apply { isDaemon = true }
    }

    @Volatile
    private var handle: Long

    init {
        ensureLoaded()
        handle = executor.submit(Callable { nativeCreate(memoryLimitBytes, stackSizeBytes) }).get()
        if (handle == 0L) {
            executor.shutdownNow()
            throw IllegalStateException("QuickJS could not create a runtime.")
        }
    }

    /** Evaluate [source] and return the JSON envelope described in ADR 017. */
    fun eval(
        source: String,
        filename: String = "<eval>",
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    ): String = executor.submit(Callable { evalBlocking(source, filename, timeoutMs) }).get()

    /**
     * Evaluate without blocking the caller; the future completes on [executor].
     *
     * The channel uses this so a long script never holds the platform thread.
     */
    fun evalAsync(
        source: String,
        filename: String = "<eval>",
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    ): CompletableFuture<String> =
        CompletableFuture.supplyAsync({ evalBlocking(source, filename, timeoutMs) }, executor)

    override fun close() {
        val current = handle
        handle = 0
        if (current != 0L) {
            try {
                executor.submit { nativeDestroy(current) }.get(5, TimeUnit.SECONDS)
            } catch (_: Exception) {
                // The only leak here is a runtime whose executor already died,
                // which means the process is going away with it.
            }
        }
        executor.shutdownNow()
    }

    private fun evalBlocking(source: String, filename: String, timeoutMs: Long): String =
        nativeEval(handle, source, filename, timeoutMs)

    private external fun nativeCreate(memoryLimitBytes: Long, stackSizeBytes: Long): Long

    private external fun nativeEval(
        handle: Long,
        source: String,
        filename: String,
        timeoutMs: Long,
    ): String

    private external fun nativeDestroy(handle: Long)

    companion object {
        const val DEFAULT_MEMORY_LIMIT_BYTES = 64L * 1024 * 1024
        const val DEFAULT_STACK_SIZE_BYTES = 1L * 1024 * 1024
        const val DEFAULT_TIMEOUT_MS = 2_000L

        @Volatile
        private var loaded = false

        /**
         * Load `libqchat_quickjs.so` once.
         *
         * Kept out of the companion initializer so a JVM unit test that only
         * reads constants does not try to load an Android library.
         */
        @Synchronized
        internal fun ensureLoaded() {
            if (loaded) return
            System.loadLibrary("qchat_quickjs")
            loaded = true
        }
    }
}
