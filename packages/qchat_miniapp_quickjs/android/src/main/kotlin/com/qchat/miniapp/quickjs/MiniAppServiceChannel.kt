package com.qchat.miniapp.quickjs

import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * `qchat/miniapp/service`: create, evaluate and destroy one QuickJS runtime.
 *
 * The channel never evaluates on the platform thread. `create` is fast (it only
 * allocates a runtime) and stays synchronous; `eval` is submitted to the
 * runtime's own executor and its result is posted back to the main looper
 * before `reply` is called, which `MethodChannel` requires.
 *
 * Errors use the contract codes from `packages/miniapp-contracts/src/errors.ts`
 * where they exist; the envelope returned by `eval` carries the script error,
 * so a thrown script is a successful channel call with `ok: false`.
 */
internal class MiniAppServiceChannel(messenger: BinaryMessenger) {
    private val channel = MethodChannel(messenger, CHANNEL)
    private val main = Handler(Looper.getMainLooper())
    private val nextRuntimeId = AtomicInteger(1)
    private val runtimes = ConcurrentHashMap<Int, QjsRuntime>()

    init {
        channel.setMethodCallHandler { call, reply -> handle(call, reply) }
    }

    fun dispose() {
        channel.setMethodCallHandler(null)
        runtimes.values.forEach { it.close() }
        runtimes.clear()
    }

    private fun handle(call: MethodCall, reply: MethodChannel.Result) {
        when (call.method) {
            "create" -> create(call, reply)
            "eval" -> eval(call, reply)
            "destroy" -> destroy(call, reply)
            else -> reply.notImplemented()
        }
    }

    private fun create(call: MethodCall, reply: MethodChannel.Result) {
        val memoryLimit = (call.argument<Number>("memoryLimitBytes"))?.toLong()
            ?: QjsRuntime.DEFAULT_MEMORY_LIMIT_BYTES
        val stackSize = (call.argument<Number>("stackSizeBytes"))?.toLong()
            ?: QjsRuntime.DEFAULT_STACK_SIZE_BYTES
        if (memoryLimit <= 0 || stackSize <= 0) {
            reply.error(
                "SERVICE_INVALID_REQUEST",
                "The runtime limits must be positive.",
                null,
            )
            return
        }
        try {
            val runtime = QjsRuntime(memoryLimit, stackSize)
            val id = nextRuntimeId.getAndIncrement()
            runtimes[id] = runtime
            reply.success(id)
        } catch (error: Throwable) {
            reply.error(
                "SERVICE_START_FAILED",
                "The QuickJS runtime could not start.",
                error.message,
            )
        }
    }

    private fun eval(call: MethodCall, reply: MethodChannel.Result) {
        val id = call.argument<Int>("runtimeId")
        val source = call.argument<String>("source")
        val filename = call.argument<String>("filename") ?: "<eval>"
        val timeoutMs = (call.argument<Number>("timeoutMs"))?.toLong()
            ?: QjsRuntime.DEFAULT_TIMEOUT_MS
        val runtime = id?.let { runtimes[it] }
        if (runtime == null || source == null || timeoutMs <= 0) {
            reply.error(
                "SERVICE_INVALID_REQUEST",
                "Unknown runtime, missing source or a non-positive timeout.",
                null,
            )
            return
        }
        runtime.evalAsync(source, filename, timeoutMs).whenComplete { result, error ->
            main.post {
                if (error == null) {
                    reply.success(result)
                } else {
                    reply.error(
                        "SERVICE_EVAL_FAILED",
                        "The QuickJS runtime failed.",
                        error.cause?.message ?: error.message,
                    )
                }
            }
        }
    }

    private fun destroy(call: MethodCall, reply: MethodChannel.Result) {
        val id = call.argument<Int>("runtimeId")
        val runtime = id?.let { runtimes.remove(it) }
        runtime?.close()
        reply.success(null)
    }

    companion object {
        const val CHANNEL = "qchat/miniapp/service"
    }
}
