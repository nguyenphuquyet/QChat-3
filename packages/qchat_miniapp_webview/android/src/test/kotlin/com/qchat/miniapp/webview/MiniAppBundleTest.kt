package com.qchat.miniapp.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class MiniAppBundleTest {

    @get:Rule
    val temp = TemporaryFolder()

    private fun installed(json: String?): File {
        val root = temp.newFolder("1.0.0")
        if (json != null) {
            val build = File(root, "build").apply { mkdirs() }
            File(build, "view.json").writeText(json, Charsets.UTF_8)
        }
        return root
    }

    private fun validJson(pageCss: String = "page{color:red}"): String = """
        {
          "format": "qchat-view-bundle",
          "formatVersion": 1,
          "appCss": "app{color:blue}",
          "pages": {
            "pages/index/index": {
              "css": "$pageCss",
              "config": {}
            }
          },
          "components": {}
        }
    """.trimIndent()

    @Test
    fun `returns the compiled page css`() {
        val result = MiniAppBundle.pageCss(installed(validJson()), "pages/index/index")
        assertTrue(result is MiniAppBundle.Result.Valid)
        assertEquals("page{color:red}", (result as MiniAppBundle.Result.Valid).css)
    }

    @Test
    fun `reports a missing bundle as an install failure`() {
        val result = MiniAppBundle.pageCss(installed(null), "pages/index/index")
        assertTrue(result is MiniAppBundle.Result.Invalid)
        assertEquals(
            MiniAppErrorCodes.PACKAGE_INSTALL_FAILED,
            (result as MiniAppBundle.Result.Invalid).code,
        )
    }

    @Test
    fun `refuses an unknown format`() {
        val result = MiniAppBundle.pageCss(
            installed(validJson().replace("qchat-view-bundle", "other-bundle")),
            "pages/index/index",
        )
        assertEquals(
            MiniAppErrorCodes.MANIFEST_INVALID,
            (result as MiniAppBundle.Result.Invalid).code,
        )
    }

    @Test
    fun `refuses an unknown format version instead of guessing`() {
        val result = MiniAppBundle.pageCss(
            installed(validJson().replace("\"formatVersion\": 1", "\"formatVersion\": 2")),
            "pages/index/index",
        )
        assertEquals(
            MiniAppErrorCodes.MANIFEST_VERSION_UNSUPPORTED,
            (result as MiniAppBundle.Result.Invalid).code,
        )
    }

    @Test
    fun `refuses a page the bundle does not contain`() {
        val result = MiniAppBundle.pageCss(installed(validJson()), "pages/other/other")
        assertEquals(
            MiniAppErrorCodes.MANIFEST_INVALID,
            (result as MiniAppBundle.Result.Invalid).code,
        )
    }

    @Test
    fun `refuses a bundle that is not JSON`() {
        val result = MiniAppBundle.pageCss(installed("not json"), "pages/index/index")
        assertEquals(
            MiniAppErrorCodes.MANIFEST_INVALID,
            (result as MiniAppBundle.Result.Invalid).code,
        )
    }
}
