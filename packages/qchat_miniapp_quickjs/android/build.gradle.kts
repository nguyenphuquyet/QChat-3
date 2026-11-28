plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.qchat.miniapp.quickjs"
    compileSdk = 36

    // Flutter's own default NDK (FlutterExtension.ndkVersion). Pinning the same
    // version means the app module and this plugin share one installed NDK.
    ndkVersion = "28.2.13676358"

    defaultConfig {
        minSdk = 26
        ndk {
            // Flutter ships these three ABIs; x86 (32-bit) is not supported by
            // current Flutter releases and is deliberately absent.
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}
