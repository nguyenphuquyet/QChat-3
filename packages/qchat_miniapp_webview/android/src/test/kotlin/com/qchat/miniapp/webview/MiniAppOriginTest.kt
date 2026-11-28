package com.qchat.miniapp.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MiniAppOriginTest {

    private fun args(
        appId: String = "com.example.hello",
        version: String = "1.0.0",
        sessionId: String = "sess_1",
        pageId: String = "p1",
        route: String = "pages/index/index",
    ): Map<String, Any> = mapOf(
        "appId" to appId,
        "version" to version,
        "sessionId" to sessionId,
        "pageId" to pageId,
        "route" to route,
    )

    private fun assertInvalid(value: Any?) {
        val result = MiniAppOrigin.bindingFrom(value)
        assertTrue("expected Invalid, got $result", result is MiniAppOrigin.BindingResult.Invalid)
        assertEquals(
            MiniAppErrorCodes.BRIDGE_INVALID_MESSAGE,
            (result as MiniAppOrigin.BindingResult.Invalid).code,
        )
    }

    @Test
    fun `accepts a manifest binding and builds the exact origin`() {
        val result = MiniAppOrigin.bindingFrom(args())
        assertTrue(result is MiniAppOrigin.BindingResult.Valid)
        val binding = (result as MiniAppOrigin.BindingResult.Valid).binding

        assertEquals("https://appassets.androidplatform.net", binding.origin)
        assertEquals("/qchat/com.example.hello/1.0.0/", binding.basePath)
        assertEquals(
            "https://appassets.androidplatform.net/qchat/com.example.hello/1.0.0/",
            binding.baseUrl,
        )
        assertEquals(
            "https://appassets.androidplatform.net/qchat/com.example.hello/1.0.0/__qchat_view.html",
            binding.pageUrl,
        )
    }

    @Test
    fun `accepts prerelease and build metadata versions`() {
        assertTrue(MiniAppOrigin.bindingFrom(args(version = "1.2.3-beta.1+42")) is MiniAppOrigin.BindingResult.Valid)
    }

    @Test
    fun `rejects a missing or foreign binding object`() {
        assertInvalid(null)
        assertInvalid("com.example.hello")
        assertInvalid(emptyMap<String, Any>())
        assertInvalid(args().minus("sessionId"))
    }

    @Test
    fun `rejects an app id that could choose another directory`() {
        assertInvalid(args(appId = "../other"))
        assertInvalid(args(appId = "Com.Example"))
        assertInvalid(args(appId = "com"))
        assertInvalid(args(appId = "com..example"))
        assertInvalid(args(appId = "com/example"))
    }

    @Test
    fun `rejects a version that could choose another directory`() {
        assertInvalid(args(version = "1.0"))
        assertInvalid(args(version = "1.0.0/../../other"))
        assertInvalid(args(version = "1.0.0 "))
        assertInvalid(args(version = "v1.0.0"))
    }

    @Test
    fun `rejects a session id outside the bridge alphabet`() {
        assertInvalid(args(sessionId = ""))
        assertInvalid(args(sessionId = "has space"))
        assertInvalid(args(sessionId = "a".repeat(129)))
    }

    @Test
    fun `rejects a page id that is not the host allocation`() {
        assertInvalid(args(pageId = "1"))
        assertInvalid(args(pageId = "p1x"))
        assertInvalid(args(pageId = "p1234567890"))
    }

    @Test
    fun `rejects a route with a traversal or a bad segment`() {
        assertInvalid(args(route = "../pages/index/index"))
        assertInvalid(args(route = "/pages/index/index"))
        assertInvalid(args(route = "pages/index/index/"))
        assertInvalid(args(route = "pages//index"))
        assertInvalid(args(route = "Pages/index"))
        assertInvalid(args(route = "pages/./index"))
    }
}
