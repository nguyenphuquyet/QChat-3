plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.qchat.miniapp.webview"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    // WebViewAssetLoader, WebViewCompat.addWebMessageListener and the settings
    // compat helpers of ADR 011 §3.
    implementation("androidx.webkit:webkit:1.14.0")

    // The unit tests exercise the pure origin/path/bundle helpers. org.json is
    // part of the Android SDK but its android.jar stub throws in JVM tests, so
    // the real implementation is on the test classpath only.
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
