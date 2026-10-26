allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// flutter_js 0.8.7 pins its Kotlin target to 1.8 while Android Gradle Plugin
// compiles its Java sources for Java 11, which fails Kotlin's JVM target
// validation on every Android build. Align the plugin's Kotlin and Java
// targets; other modules keep their own configuration.
subprojects {
    if (name == "flutter_js") {
        afterEvaluate {
            extensions.findByName("android")?.withGroovyBuilder {
                "compileOptions" {
                    setProperty("sourceCompatibility", JavaVersion.VERSION_11)
                    setProperty("targetCompatibility", JavaVersion.VERSION_11)
                }
                "kotlinOptions" {
                    setProperty("jvmTarget", "11")
                }
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
