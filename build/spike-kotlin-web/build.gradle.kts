plugins {
    kotlin("multiplatform") version "2.3.21"
}
repositories { mavenCentral() }
kotlin {
    js(IR) {
        browser {
            commonWebpackConfig { outputFileName = "asteroids.js" }
        }
        binaries.executable()
    }
}
