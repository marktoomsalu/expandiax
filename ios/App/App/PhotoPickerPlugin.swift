import Foundation
import Capacitor
import PhotosUI
import UniformTypeIdentifiers
import ImageIO

// Picking photos without waiting on iCloud.
//
// A web page's photo input only returns once every chosen photo has been
// downloaded from iCloud, so the picker's ✓ seems to do nothing for a
// while. This picker closes the moment ✓ is tapped and answers with how
// many were chosen; each photo then follows on its own, downloaded in the
// background (with progress), shrunk here to upload size (2560 px JPEG)
// and kept with when and where it was taken (EXIF date and GPS), so the
// website can place and order it. Events: progress, loaded, failed.
@objc(PhotoPickerPlugin)
public class PhotoPickerPlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "PhotoPickerPlugin"
    public let jsName = "PhotoPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pick", returnType: CAPPluginReturnPromise)
    ]

    private var pending: CAPPluginCall?
    private var observations: [String: NSKeyValueObservation] = [:]
    private let lock = NSLock()

    @objc func pick(_ call: CAPPluginCall) {
        let limit = max(0, call.getInt("limit") ?? 0)
        DispatchQueue.main.async {
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.selectionLimit = limit // 0 = no limit
            config.filter = .images
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
