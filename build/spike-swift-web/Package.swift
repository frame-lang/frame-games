// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "AsteroidsSwift",
    dependencies: [
        .package(url: "https://github.com/swiftwasm/JavaScriptKit", from: "0.42.0")
    ],
    targets: [
        .executableTarget(
            name: "AsteroidsSwift",
            dependencies: [.product(name: "JavaScriptKit", package: "JavaScriptKit")]
        )
    ]
)
