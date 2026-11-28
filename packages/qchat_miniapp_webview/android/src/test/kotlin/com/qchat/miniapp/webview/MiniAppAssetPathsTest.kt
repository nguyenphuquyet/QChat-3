package com.qchat.miniapp.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class MiniAppAssetPathsTest {

    @get:Rule
    val temp = TemporaryFolder()

    private val prefix = "/qchat/com.example.hello/1.0.0/"

    @Test
    fun `maps a prefixed path to a path under the installed directory`() {
        assertEquals(
            "assets/logo.png",
            MiniAppAssetPaths.relativePath("${prefix}assets/logo.png", prefix),
        )
        assertEquals(
            "pages/index/photo one.png",
            MiniAppAssetPaths.relativePath("${prefix}pages/index/photo%20one.png", prefix),
        )
    }

    @Test
    fun `keeps a literal plus in a file name`() {
        assertEquals(
            "assets/a+b.png",
            MiniAppAssetPaths.relativePath("${prefix}assets/a+b.png", prefix),
        )
    }

    @Test
    fun `rejects another prefix or an empty path`() {
        assertNull(MiniAppAssetPaths.relativePath("/qchat/other/1.0.0/assets/logo.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath(prefix, prefix))
        assertNull(MiniAppAssetPaths.relativePath("/qchat-host/qchat-view.js", prefix))
    }

    @Test
    fun `rejects every traversal spelling`() {
        assertNull(MiniAppAssetPaths.relativePath("${prefix}../secret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}%2e%2e/secret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}..%2Fsecret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}assets/../../secret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}assets%5Csecret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}assets/./logo.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}assets//logo.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}C:/secret.png", prefix))
        assertNull(MiniAppAssetPaths.relativePath("${prefix}assets/%00.png", prefix))
    }

    @Test
    fun `serves only view assets, never service code or the manifest`() {
        assertTrue(MiniAppAssetPaths.isViewAsset("assets/logo.png"))
        assertTrue(MiniAppAssetPaths.isViewAsset("assets/logo.PNG"))
        assertTrue(MiniAppAssetPaths.isViewAsset("assets/font.woff2"))
        assertTrue(MiniAppAssetPaths.isViewAsset("assets/intro.mp4"))

        assertFalse(MiniAppAssetPaths.isViewAsset("app.js"))
        assertFalse(MiniAppAssetPaths.isViewAsset("pages/index/index.js"))
        assertFalse(MiniAppAssetPaths.isViewAsset("pages/index/index.wxml"))
        assertFalse(MiniAppAssetPaths.isViewAsset("pages/index/index.wxss"))
        assertFalse(MiniAppAssetPaths.isViewAsset("build/view.json"))
        assertFalse(MiniAppAssetPaths.isViewAsset("manifest.json"))
        assertFalse(MiniAppAssetPaths.isViewAsset(".hidden.png"))
        assertFalse(MiniAppAssetPaths.isViewAsset("assets/noextension"))
    }

    @Test
    fun `resolves a real file under the root`() {
        val root = temp.newFolder("1.0.0")
        val assets = File(root, "assets").apply { mkdirs() }
        File(assets, "logo.png").writeBytes(byteArrayOf(1, 2, 3))

        val file = MiniAppAssetPaths.resolve(root, "assets/logo.png")
        assertNotNull(file)
        assertTrue(file!!.path.startsWith(root.canonicalPath))
    }

    @Test
    fun `refuses to resolve outside the root or a denied extension`() {
        val root = temp.newFolder("1.0.0")
        val outside = temp.newFile("secret.png").apply { writeBytes(byteArrayOf(9)) }
        assertTrue(outside.isFile)

        assertNull(MiniAppAssetPaths.resolve(root, "../secret.png"))
        assertNull(MiniAppAssetPaths.resolve(root, "app.js"))
        assertNull(MiniAppAssetPaths.resolve(root, "assets/missing.png"))
    }

    @Test
    fun `maps the extension to a mime type`() {
        assertEquals("image/png", MiniAppAssetPaths.mimeType("a.png"))
        assertEquals("image/svg+xml", MiniAppAssetPaths.mimeType("a.svg"))
        assertEquals("font/woff2", MiniAppAssetPaths.mimeType("a.woff2"))
        assertEquals("video/mp4", MiniAppAssetPaths.mimeType("a.mp4"))
        assertEquals("application/octet-stream", MiniAppAssetPaths.mimeType("a.unknown"))
    }
}
