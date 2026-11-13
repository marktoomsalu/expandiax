import Foundation
import Capacitor
import PhotosUI
import UniformTypeIdentifiers
import ImageIO
import AVFoundation

// Picking photos without waiting on iCloud.
//
// A web page's photo input only returns once every chosen photo has been
// downloaded from iCloud, so the picker's ✓ seems to do nothing for a
// while. This picker closes the moment ✓ is tapped and answers with how
// many were chosen; each photo then follows on its own, downloaded in the
// background (with progress), shrunk here to upload size (2560 px JPEG)
// and kept with when and where it was taken (EXIF date and GPS), so the
// website can place and order it. Events: progress, loaded, failed.
//
// Videos too (when asked, from build 11): the picker closes straight away
// as well, and each video is fetched (from iCloud if need be) and made
// upload-ready here with the phone's own encoder (720p for "standard",
// the original for "hd"), then handed over in pieces ("chunk" events, then
// "loaded" with chunked: true), as one long string would be too much.
@objc(PhotoPickerPlugin)
public class PhotoPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "PhotoPickerPlugin"
    public let jsName = "PhotoPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "features", returnType: CAPPluginReturnPromise)
    ]

    /// What this build's picker can do, so the website knows (older builds don't have this).
    @objc func features(_ call: CAPPluginCall) {
        call.resolve(["videos": true])
    }

    private var wantsHD = false
    private static let chunkBytes = 1_500_000

    private var pending: CAPPluginCall?
    private var observations: [String: NSKeyValueObservation] = [:]
    private let lock = NSLock()

    @objc func pick(_ call: CAPPluginCall) {
        let limit = max(0, call.getInt("limit") ?? 0)
        let videos = call.getBool("videos") ?? false
        wantsHD = call.getString("videoQuality") == "hd"
        DispatchQueue.main.async {
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.selectionLimit = limit // 0 = no limit
            config.filter = videos ? .any(of: [.images, .videos]) : .images
            // The file as it is (HEIC on most iPhones): no waiting on a conversion.
            config.preferredAssetRepresentationMode = .current
            config.selection = .ordered
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.pending = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pending else { return }
        pending = nil
        let ids = results.map { _ in UUID().uuidString }
        call.resolve(["items": ids.map { ["id": $0] }])

        for (i, result) in results.enumerated() {
            let id = ids[i]
            let provider = result.itemProvider
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                loadVideo(provider, id: id, index: i)
                continue
            }
            let type = provider.registeredTypeIdentifiers.first { UTType($0)?.conforms(to: .image) == true } ?? UTType.image.identifier
            let name = (provider.suggestedName ?? "photo-\(i + 1)") + ".jpg"
            let progress = provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, error in
                guard let self = self else { return }
                self.stopObserving(id)
                // The file is only there during this callback: read it now.
                guard let url = url, let data = Self.uploadReady(url) else {
                    self.send("failed", ["id": id, "message": error?.localizedDescription ?? "Couldn't read this photo."])
                    return
                }
                self.send("loaded", ["id": id, "name": name, "data": data.base64EncodedString()])
            }
            var last = -1.0
            let observation = progress.observe(\.fractionCompleted, options: [.new]) { [weak self] p, _ in
                // A few updates per photo is enough for a progress bar.
                if p.fractionCompleted - last >= 0.05 || p.fractionCompleted >= 1 {
                    last = p.fractionCompleted
                    self?.send("progress", ["id": id, "fraction": p.fractionCompleted])
                }
            }
            lock.lock()
            observations[id] = observation
            lock.unlock()
        }
    }

    // MARK: Videos

    private func loadVideo(_ provider: NSItemProvider, id: String, index: Int) {
        let hd = wantsHD
        let base = provider.suggestedName ?? "video-\(index + 1)"
        let progress = provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { [weak self] url, error in
            guard let self = self else { return }
            self.stopObserving(id)
            // Only there during this callback: keep a copy to work on.
            guard let url = url else {
                self.send("failed", ["id": id, "message": error?.localizedDescription ?? "Couldn't read this video."])
                return
            }
            let copy = FileManager.default.temporaryDirectory.appendingPathComponent("pick-\(id).\(url.pathExtension.isEmpty ? "mov" : url.pathExtension)")
            try? FileManager.default.removeItem(at: copy)
            do { try FileManager.default.copyItem(at: url, to: copy) } catch {
                self.send("failed", ["id": id, "message": "Couldn't read this video."])
                return
            }
            if hd {
                self.handOver(copy, id: id, name: "\(base).\(copy.pathExtension.lowercased())", type: copy.pathExtension.lowercased() == "mp4" ? "video/mp4" : "video/quicktime", cleanUp: [copy])
            } else {
                self.compress(copy, id: id, name: "\(base).expandiax.mp4")
            }
        }
        // Fetching (iCloud) is the first half of the bar; getting it ready the second.
        var last = -1.0
        let observation = progress.observe(\.fractionCompleted, options: [.new]) { [weak self] p, _ in
            if p.fractionCompleted - last >= 0.05 || p.fractionCompleted >= 1 {
                last = p.fractionCompleted
                self?.send("progress", ["id": id, "fraction": p.fractionCompleted * (hd ? 0.9 : 0.5)])
            }
        }
        lock.lock()
        observations[id] = observation
        lock.unlock()
    }

    /// 720p H.264 MP4 with the phone's own encoder: seconds, not minutes.
    private func compress(_ source: URL, id: String, name: String) {
        let asset = AVURLAsset(url: source)
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("ready-\(id).mp4")
        try? FileManager.default.removeItem(at: out)
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
            handOver(source, id: id, name: name.replacingOccurrences(of: ".expandiax.mp4", with: ".mov"), type: "video/quicktime", cleanUp: [source])
            return
        }
        session.outputURL = out
        session.outputFileType = .mp4
        session.shouldOptimizeForNetworkUse = true
        let timer = DispatchSource.makeTimerSource(queue: .global())
        timer.schedule(deadline: .now() + 0.5, repeating: 0.5)
        timer.setEventHandler { [weak self] in
            self?.send("progress", ["id": id, "fraction": 0.5 + Double(session.progress) * 0.4])
        }
        timer.resume()
        session.exportAsynchronously { [weak self] in
            timer.cancel()
            guard let self = self else { return }
            if session.status == .completed {
                self.handOver(out, id: id, name: name, type: "video/mp4", cleanUp: [source, out])
            } else {
                // Couldn't make it smaller: the original goes instead (the website can still shrink it).
                try? FileManager.default.removeItem(at: out)
                self.handOver(source, id: id, name: name.replacingOccurrences(of: ".expandiax.mp4", with: ".mov"), type: "video/quicktime", cleanUp: [source])
            }
        }
    }

    /// Sends the file in pieces, then "loaded"; the temporary files go after.
    private func handOver(_ file: URL, id: String, name: String, type: String, cleanUp: [URL]) {
        DispatchQueue.global(qos: .userInitiated).async {
            defer { cleanUp.forEach { try? FileManager.default.removeItem(at: $0) } }
            guard let handle = try? FileHandle(forReadingFrom: file) else {
                self.send("failed", ["id": id, "message": "Couldn't read this video."])
                return
            }
            defer { try? handle.close() }
            var index = 0
            while true {
                let data = handle.readData(ofLength: Self.chunkBytes)
                if data.isEmpty { break }
                self.send("chunk", ["id": id, "index": index, "data": data.base64EncodedString()])
                index += 1
            }
            self.send("loaded", ["id": id, "name": name, "type": type, "chunked": true, "chunks": index])
        }
    }

    private func stopObserving(_ id: String) {
        lock.lock()
        observations.removeValue(forKey: id)?.invalidate()
        lock.unlock()
    }

    private func send(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async {
            self.notifyListeners(event, data: data)
        }
    }

    /// The photo as a JPEG at most 2560 px on its longest side, the right way
    /// up, keeping its EXIF (when) and GPS (where) for the website to read.
    private static func uploadReady(_ url: URL) -> Data? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] ?? [:]
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2560
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        var meta: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 0.85, kCGImagePropertyOrientation: 1]
        if let exif = props[kCGImagePropertyExifDictionary] { meta[kCGImagePropertyExifDictionary] = exif }
        if let gps = props[kCGImagePropertyGPSDictionary] { meta[kCGImagePropertyGPSDictionary] = gps }
        if var tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any] {
            tiff[kCGImagePropertyTIFFOrientation] = 1
            meta[kCGImagePropertyTIFFDictionary] = tiff
        }
        CGImageDestinationAddImage(dest, image, meta as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return out as Data
    }
}
