import AppKit
import Foundation
import WebKit

let environment = ProcessInfo.processInfo.environment

let urlString = environment["CHAT_SCREENSHOT_URL"] ?? "http://127.0.0.1:3000/chat"
let outputPath = environment["CHAT_SCREENSHOT_OUTPUT"] ?? "docs/screenshots/chat-page.png"
let width = Int(environment["CHAT_SCREENSHOT_WIDTH"] ?? "1440") ?? 1440
let height = Int(environment["CHAT_SCREENSHOT_HEIGHT"] ?? "900") ?? 900
let delaySeconds = Double(environment["CHAT_SCREENSHOT_DELAY"] ?? "1.0") ?? 1.0

guard let url = URL(string: urlString) else {
  fputs("Invalid CHAT_SCREENSHOT_URL: \(urlString)\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath, relativeTo: URL(fileURLWithPath: FileManager.default.currentDirectoryPath))
let outputDirectoryURL = outputURL.deletingLastPathComponent()

do {
  try FileManager.default.createDirectory(at: outputDirectoryURL, withIntermediateDirectories: true)
} catch {
  fputs("Failed to create output directory: \(error)\n", stderr)
  exit(1)
}

final class ScreenshotDelegate: NSObject, WKNavigationDelegate {
  private let webView: WKWebView
  private let outputURL: URL
  private let delaySeconds: Double

  init(webView: WKWebView, outputURL: URL, delaySeconds: Double) {
    self.webView = webView
    self.outputURL = outputURL
    self.delaySeconds = delaySeconds
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + delaySeconds) {
      let configuration = WKSnapshotConfiguration()
      configuration.rect = CGRect(origin: .zero, size: webView.bounds.size)

      webView.takeSnapshot(with: configuration) { image, error in
        if let error {
          fputs("Failed to capture screenshot: \(error)\n", stderr)
          NSApplication.shared.terminate(nil)
          return
        }

        guard
          let image,
          let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let data = bitmap.representation(using: .png, properties: [:])
        else {
          fputs("Failed to encode screenshot as PNG\n", stderr)
          NSApplication.shared.terminate(nil)
          return
        }

        do {
          try data.write(to: self.outputURL)
          print("Saved screenshot to \(self.outputURL.path)")
        } catch {
          fputs("Failed to write screenshot: \(error)\n", stderr)
        }

        NSApplication.shared.terminate(nil)
      }
    }
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    fputs("Navigation failed: \(error)\n", stderr)
    NSApplication.shared.terminate(nil)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    fputs("Navigation failed: \(error)\n", stderr)
    NSApplication.shared.terminate(nil)
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let configuration = WKWebViewConfiguration()
configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")

let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: height), configuration: configuration)
let delegate = ScreenshotDelegate(webView: webView, outputURL: outputURL, delaySeconds: delaySeconds)
webView.navigationDelegate = delegate

let window = NSWindow(
  contentRect: CGRect(x: -10_000, y: -10_000, width: width, height: height),
  styleMask: [.borderless],
  backing: .buffered,
  defer: false
)
window.contentView = webView
window.orderOut(nil)

webView.load(URLRequest(url: url))
app.run()
