package com.qchat.miniapp.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class MiniAppInstallPathsTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `derives the version directory the host reads`() {
        val files = temp.newFolder("files")
        val dir = MiniAppInstallPaths.versionDir(files, "com.example.hello", "1.0.0")

        assertEquals(
            File(File(files, "miniapps/apps/com.example.hello"), "versions/1.0.0"),
            dir,
        )
        assertEquals(
            File(dir, "build/view.json"),
            MiniAppInstallPaths.bundleFile(files, "com.example.hello", "1.0.0"),
        )
    }

    @Test
    fun `keeps the app directory under the files directory`() {
        val files = temp.newFolder("files")
        val dir = MiniAppInstallPaths.versionDir(files, "com.example.hello", "1.0.0")

        assertTrue(dir.path.startsWith(files.path))
        assertFalse(dir.path.contains(".."))
    }

    @Test
    fun `validates the ids the installer channel accepts`() {
        assertTrue(MiniAppOrigin.isAppId("com.example.hello"))
        assertFalse(MiniAppOrigin.isAppId("../other"))
        assertFalse(MiniAppOrigin.isAppId("com"))
        assertFalse(MiniAppOrigin.isAppId("Com.Example"))

        assertTrue(MiniAppOrigin.isVersion("1.2.3-beta.1+42"))
        assertFalse(MiniAppOrigin.isVersion("1.0.0/../../other"))
        assertFalse(MiniAppOrigin.isVersion("v1.0.0"))
    }
}
