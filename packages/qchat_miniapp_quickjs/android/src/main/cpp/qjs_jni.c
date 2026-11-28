/*
 * JNI boundary for the QuickJS service runtime (ADR 017).
 *
 * One handle owns one JSRuntime/JSContext pair and is only touched from the
 * thread that created it: QjsRuntime submits every call to its own single-thread
 * executor, so this file does not need locks.
 *
 * nativeEval returns a JSON envelope:
 *   {"ok":true,"result":<json>}
 *   {"ok":false,"error":{"name":"...","message":"...","stack":"..."}}
 *
 * The envelope is built here rather than in Kotlin so a script error and a
 * channel error stay distinct: a thrown script is a successful call with
 * ok:false, and only a broken runtime makes the channel fail.
 */

#include <jni.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "quickjs.h"

typedef struct {
    JSRuntime *runtime;
    JSContext *context;
    int64_t deadline_ms;
} QjsHandle;

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} Buffer;

static int64_t monotonic_ms(void) {
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    return (int64_t)now.tv_sec * 1000 + now.tv_nsec / 1000000;
}

static int buffer_reserve(Buffer *buffer, size_t extra) {
    if (buffer->length + extra + 1 <= buffer->capacity) return 1;
    size_t capacity = buffer->capacity == 0 ? 128 : buffer->capacity;
    while (capacity < buffer->length + extra + 1) capacity *= 2;
    char *data = (char *)realloc(buffer->data, capacity);
    if (data == NULL) return 0;
    buffer->data = data;
    buffer->capacity = capacity;
    return 1;
}

static int buffer_append_n(Buffer *buffer, const char *text, size_t length) {
    if (!buffer_reserve(buffer, length)) return 0;
    memcpy(buffer->data + buffer->length, text, length);
    buffer->length += length;
    buffer->data[buffer->length] = '\0';
    return 1;
}

static int buffer_append(Buffer *buffer, const char *text) {
    return buffer_append_n(buffer, text, strlen(text));
}

static int buffer_append_json_string(Buffer *buffer, const char *text) {
    if (!buffer_append(buffer, "\"")) return 0;
    for (const unsigned char *at = (const unsigned char *)text; *at != 0; at++) {
        unsigned char c = *at;
        switch (c) {
        case '"':
            if (!buffer_append(buffer, "\\\"")) return 0;
            break;
        case '\\':
            if (!buffer_append(buffer, "\\\\")) return 0;
            break;
        case '\b':
            if (!buffer_append(buffer, "\\b")) return 0;
            break;
        case '\f':
            if (!buffer_append(buffer, "\\f")) return 0;
            break;
        case '\n':
            if (!buffer_append(buffer, "\\n")) return 0;
            break;
        case '\r':
            if (!buffer_append(buffer, "\\r")) return 0;
            break;
        case '\t':
            if (!buffer_append(buffer, "\\t")) return 0;
            break;
        default:
            if (c < 0x20) {
                char escaped[7];
                snprintf(escaped, sizeof(escaped), "\\u%04x", (unsigned)c);
                if (!buffer_append(buffer, escaped)) return 0;
            } else if (!buffer_append_n(buffer, (const char *)at, 1)) {
                return 0;
            }
            break;
        }
    }
    return buffer_append(buffer, "\"");
}

/*
 * JNI strings are UTF-16; QuickJS source and output are UTF-8. Going through
 * GetStringUTFChars would produce CESU-8, which QuickJS decodes as replacement
 * characters, so the conversion is explicit in both directions.
 */
static char *jstring_to_utf8(JNIEnv *env, jstring value, size_t *out_length) {
    if (value == NULL) return NULL;
    jsize length = (*env)->GetStringLength(env, value);
    const jchar *units = (*env)->GetStringChars(env, value, NULL);
    if (units == NULL) return NULL;

    char *out = (char *)malloc((size_t)length * 4 + 1);
    if (out == NULL) {
        (*env)->ReleaseStringChars(env, value, units);
        return NULL;
    }

    size_t at = 0;
    for (jsize index = 0; index < length; index++) {
        uint32_t code = units[index];
        if (code >= 0xD800 && code <= 0xDBFF && index + 1 < length) {
            uint32_t low = units[index + 1];
            if (low >= 0xDC00 && low <= 0xDFFF) {
                code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
                index++;
            }
        }
        if (code < 0x80) {
            out[at++] = (char)code;
        } else if (code < 0x800) {
            out[at++] = (char)(0xC0 | (code >> 6));
            out[at++] = (char)(0x80 | (code & 0x3F));
        } else if (code < 0x10000) {
            out[at++] = (char)(0xE0 | (code >> 12));
            out[at++] = (char)(0x80 | ((code >> 6) & 0x3F));
            out[at++] = (char)(0x80 | (code & 0x3F));
        } else {
            out[at++] = (char)(0xF0 | (code >> 18));
            out[at++] = (char)(0x80 | ((code >> 12) & 0x3F));
            out[at++] = (char)(0x80 | ((code >> 6) & 0x3F));
            out[at++] = (char)(0x80 | (code & 0x3F));
        }
    }
    out[at] = '\0';
    (*env)->ReleaseStringChars(env, value, units);
    if (out_length != NULL) *out_length = at;
    return out;
}

static jstring utf8_to_jstring(JNIEnv *env, const char *text) {
    if (text == NULL) return NULL;
    size_t length = strlen(text);
    jchar *units = (jchar *)malloc((length + 1) * sizeof(jchar));
    if (units == NULL) return NULL;

    size_t at = 0;
    for (size_t index = 0; index < length;) {
        unsigned char c = (unsigned char)text[index++];
        uint32_t code;
        int extra;
        if (c < 0x80) {
            code = c;
            extra = 0;
        } else if ((c & 0xE0) == 0xC0) {
            code = c & 0x1F;
            extra = 1;
        } else if ((c & 0xF0) == 0xE0) {
            code = c & 0x0F;
            extra = 2;
        } else if ((c & 0xF8) == 0xF0) {
            code = c & 0x07;
            extra = 3;
        } else {
            code = 0xFFFD;
            extra = 0;
        }
        for (int part = 0; part < extra && index < length; part++, index++) {
            code = (code << 6) | ((unsigned char)text[index] & 0x3F);
        }
        if (code >= 0x10000) {
            code -= 0x10000;
            units[at++] = (jchar)(0xD800 + (code >> 10));
            units[at++] = (jchar)(0xDC00 + (code & 0x3FF));
        } else {
            units[at++] = (jchar)code;
        }
    }

    jstring result = (*env)->NewString(env, units, (jsize)at);
    free(units);
    return result;
}

static jstring fallback_error(JNIEnv *env) {
    return (*env)->NewStringUTF(
        env,
        "{\"ok\":false,\"error\":{\"name\":\"Error\","
        "\"message\":\"The QuickJS runtime could not encode its result.\","
        "\"stack\":\"\"}}");
}

static jstring make_error(
    JNIEnv *env,
    const char *name,
    const char *message,
    const char *stack) {
    Buffer buffer = {0};
    int built = buffer_append(&buffer, "{\"ok\":false,\"error\":{\"name\":") &&
                buffer_append_json_string(&buffer, name != NULL ? name : "Error") &&
                buffer_append(&buffer, ",\"message\":") &&
                buffer_append_json_string(
                    &buffer,
                    message != NULL ? message : "The script threw an error.") &&
                buffer_append(&buffer, ",\"stack\":") &&
                buffer_append_json_string(&buffer, stack != NULL ? stack : "") &&
                buffer_append(&buffer, "}}");
    jstring result = built ? utf8_to_jstring(env, buffer.data) : NULL;
    free(buffer.data);
    if (result == NULL) return fallback_error(env);
    return result;
}

static jstring make_success(JNIEnv *env, const char *json, size_t length) {
    Buffer buffer = {0};
    int built = buffer_append(&buffer, "{\"ok\":true,\"result\":") &&
                (json != NULL ? buffer_append_n(&buffer, json, length)
                              : buffer_append(&buffer, "null")) &&
                buffer_append(&buffer, "}");
    jstring result = built ? utf8_to_jstring(env, buffer.data) : NULL;
    free(buffer.data);
    if (result == NULL) return fallback_error(env);
    return result;
}

static char *js_string_property(JSContext *context, JSValueConst object, const char *name) {
    JSValue value = JS_GetPropertyStr(context, object, name);
    if (JS_IsException(value)) {
        JS_FreeValue(context, JS_GetException(context));
        return NULL;
    }
    char *text = NULL;
    if (!JS_IsUndefined(value) && !JS_IsNull(value)) {
        text = (char *)JS_ToCString(context, value);
        if (text == NULL) {
            JS_FreeValue(context, JS_GetException(context));
        }
    }
    JS_FreeValue(context, value);
    return text;
}

static int qjs_interrupt(JSRuntime *runtime, void *opaque) {
    (void)runtime;
    QjsHandle *handle = (QjsHandle *)opaque;
    if (handle->deadline_ms <= 0) return 0;
    return monotonic_ms() >= handle->deadline_ms;
}

JNIEXPORT jlong JNICALL
Java_com_qchat_miniapp_quickjs_QjsRuntime_nativeCreate(
    JNIEnv *env,
    jobject thiz,
    jlong memory_limit_bytes,
    jlong stack_size_bytes) {
    (void)env;
    (void)thiz;

    QjsHandle *handle = (QjsHandle *)calloc(1, sizeof(QjsHandle));
    if (handle == NULL) return 0;

    handle->runtime = JS_NewRuntime();
    if (handle->runtime == NULL) {
        free(handle);
        return 0;
    }
    if (memory_limit_bytes > 0) {
        JS_SetMemoryLimit(handle->runtime, (size_t)memory_limit_bytes);
    }
    if (stack_size_bytes > 0) {
        JS_SetMaxStackSize(handle->runtime, (size_t)stack_size_bytes);
    }
    JS_SetInterruptHandler(handle->runtime, qjs_interrupt, handle);

    handle->context = JS_NewContext(handle->runtime);
    if (handle->context == NULL) {
        JS_FreeRuntime(handle->runtime);
        free(handle);
        return 0;
    }
    return (jlong)(intptr_t)handle;
}

JNIEXPORT jstring JNICALL
Java_com_qchat_miniapp_quickjs_QjsRuntime_nativeEval(
    JNIEnv *env,
    jobject thiz,
    jlong handle_value,
    jstring source,
    jstring filename,
    jlong timeout_ms) {
    (void)thiz;

    QjsHandle *handle = (QjsHandle *)(intptr_t)handle_value;
    if (handle == NULL || handle->context == NULL) {
        return make_error(env, "Error", "The QuickJS runtime is closed.", NULL);
    }

    size_t source_length = 0;
    char *source_utf8 = jstring_to_utf8(env, source, &source_length);
    if (source_utf8 == NULL) {
        return make_error(env, "Error", "The script source could not be read.", NULL);
    }
    char *filename_utf8 = jstring_to_utf8(env, filename, NULL);

    handle->deadline_ms = timeout_ms > 0 ? monotonic_ms() + timeout_ms : 0;
    JSValue value = JS_Eval(
        handle->context,
        source_utf8,
        source_length,
        filename_utf8 != NULL ? filename_utf8 : "<eval>",
        JS_EVAL_TYPE_GLOBAL);
    int timed_out = handle->deadline_ms > 0 && monotonic_ms() >= handle->deadline_ms;
    handle->deadline_ms = 0;

    free(source_utf8);
    free(filename_utf8);

    jstring result;
    if (JS_IsException(value)) {
        if (timed_out) {
            JS_FreeValue(handle->context, JS_GetException(handle->context));
            result = make_error(
                env,
                "TimeoutError",
                "The script exceeded its time limit.",
                NULL);
        } else {
            JSValue exception = JS_GetException(handle->context);
            char *name = js_string_property(handle->context, exception, "name");
            char *message = js_string_property(handle->context, exception, "message");
            char *stack = js_string_property(handle->context, exception, "stack");
            result = make_error(env, name, message, stack);
            if (name != NULL) JS_FreeCString(handle->context, name);
            if (message != NULL) JS_FreeCString(handle->context, message);
            if (stack != NULL) JS_FreeCString(handle->context, stack);
            JS_FreeValue(handle->context, exception);
        }
    } else {
        JSValue json = JS_JSONStringify(
            handle->context,
            value,
            JS_UNDEFINED,
            JS_UNDEFINED);
        if (JS_IsException(json)) {
            JS_FreeValue(handle->context, JS_GetException(handle->context));
            result = make_error(
                env,
                "TypeError",
                "The result cannot be represented as JSON.",
                NULL);
        } else if (JS_IsUndefined(json)) {
            result = make_success(env, NULL, 0);
        } else {
            size_t json_length = 0;
            const char *json_text = JS_ToCStringLen(handle->context, &json_length, json);
            if (json_text == NULL) {
                JS_FreeValue(handle->context, JS_GetException(handle->context));
                result = make_error(
                    env,
                    "Error",
                    "The result could not be encoded.",
                    NULL);
            } else {
                result = make_success(env, json_text, json_length);
                JS_FreeCString(handle->context, json_text);
            }
        }
        JS_FreeValue(handle->context, json);
    }

    JS_FreeValue(handle->context, value);
    return result;
}

JNIEXPORT void JNICALL
Java_com_qchat_miniapp_quickjs_QjsRuntime_nativeDestroy(
    JNIEnv *env,
    jobject thiz,
    jlong handle_value) {
    (void)env;
    (void)thiz;

    QjsHandle *handle = (QjsHandle *)(intptr_t)handle_value;
    if (handle == NULL) return;
    if (handle->context != NULL) JS_FreeContext(handle->context);
    if (handle->runtime != NULL) JS_FreeRuntime(handle->runtime);
    free(handle);
}
