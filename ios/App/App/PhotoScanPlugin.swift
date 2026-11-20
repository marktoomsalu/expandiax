import Foundation
import Capacitor
import Photos
import CoreLocation
import UIKit

// "Find my world": the trips hiding in the photo library.
//
// Native only reads WHEN and WHERE photos were taken, here on the phone,
// and hands the website a compact summary: one entry per day and place
// (about 25 km squares), with how many photos and the best one to show.
// The website turns that into countries and trips and runs the whole
// experience, so it can change without an App Store release.
//
// Nothing leaves the phone here. Pictures are only made (images) for the
// cards on screen and, once someone keeps a trip and has an account, for
// that trip's cover, without location or camera data.
//
// Events: progress { done, total, located } while scanning.
@objc(PhotoScanPlugin)
public class PhotoScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoScanPlugin"
    public let jsName = "PhotoScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "access", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "chooseMore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "images", returnType: CAPPluginReturnPromise),
    ]

    private func statusName(_ s: PHAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "full"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "ask"
        @unknown default: return "denied"
        }
    }

    /// Where photo access stands, without asking.
    @objc func access(_ call: CAPPluginCall) {
        call.resolve(["status": statusName(PHPhotoLibrary.authorizationStatus(for: .readWrite))])
    }

    /// iOS's own question (only shown once; after that it just answers).
    @objc func requestAccess(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["status": self.statusName(status)])
        }
    }

    /// The app's page in Settings, for someone who said no and changed their mind.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    /// With "Limited" access: iOS's picker to add more photos to what the app may see.
    @objc func chooseMore(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.resolve()
                return
            }
            PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: vc) { _ in
                call.resolve()
            }
        }
    }

    private struct Place {
        var day: String
        var latSum: Double
        var lngSum: Double
        var count: Int
        var favourites: Int
        var best: String
        var bestScore: Double
    }

    /// Every photo and video with a place and a date, summed up per day and place.
    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
            options.predicate = NSPredicate(
                format: "mediaType == %d || mediaType == %d",
                PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue
            )
            // Your own library (and iCloud Shared Library), not albums others shared.
            options.includeAssetSourceTypes = [.typeUserLibrary, .typeiTunesSynced]
            let assets = PHAsset.fetchAssets(with: options)
            let total = assets.count

            let format = DateFormatter()
            format.calendar = Calendar(identifier: .gregorian)
            format.locale = Locale(identifier: "en_US_POSIX")
            format.timeZone = TimeZone(identifier: "UTC")
            format.dateFormat = "yyyy-MM-dd"

            var places: [String: Place] = [:]
            var located = 0
            var lastReport = Date.distantPast

            assets.enumerateObjects { asset, index, _ in
                let now = Date()
                if now.timeIntervalSince(lastReport) > 0.12 {
                    lastReport = now
                    self.notifyListeners("progress", data: ["done": index, "total": total, "located": located])
                }
                guard let location = asset.location, let date = asset.creationDate else { return }
                let c = location.coordinate
                guard CLLocationCoordinate2DIsValid(c), !(c.latitude == 0 && c.longitude == 0) else { return }
                located += 1

                // The day where it was taken: UTC moved by the longitude (an
                // hour per 15°), near enough to local time to group trips.
                let day = format.string(from: date.addingTimeInterval(c.longitude * 240))
                let lat = (c.latitude * 4).rounded() / 4
                let lng = (c.longitude * 4).rounded() / 4
                let key = "\(day)|\(lat)|\(lng)"

                // The picture to show for this day and place: a favourite
                // first, a photo before a video or a screenshot, then the larger.
                let weak = asset.mediaType == .video || asset.mediaSubtypes.contains(.photoScreenshot)
                let score = (asset.isFavorite ? 1000.0 : 0) + (weak ? -500 : 0)
                    + Double(asset.pixelWidth * asset.pixelHeight) / 1e8

                if var p = places[key] {
                    p.count += 1
                    if asset.isFavorite { p.favourites += 1 }
                    p.latSum += c.latitude
                    p.lngSum += c.longitude
                    if score > p.bestScore {
                        p.best = asset.localIdentifier
                        p.bestScore = score
                    }
                    places[key] = p
                } else {
                    places[key] = Place(
                        day: day, latSum: c.latitude, lngSum: c.longitude, count: 1,
                        favourites: asset.isFavorite ? 1 : 0, best: asset.localIdentifier, bestScore: score
                    )
                }
            }
            self.notifyListeners("progress", data: ["done": total, "total": total, "located": located])

            let out: [[String: Any]] = places.values.map { p in
                [
                    "d": p.day,
                    "la": p.latSum / Double(p.count),
                    "ln": p.lngSum / Double(p.count),
                    "n": p.count,
                    "f": p.favourites,
                    "a": p.best,
                ]
            }
            call.resolve(["total": total, "located": located, "places": out])
        }
    }

    /// Pictures of the given photos, at most `size` px on the long side, as
    /// JPEG (base64) without location or camera data. Fetched from iCloud
    /// when the phone only keeps a small copy.
    @objc func images(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        let size = CGFloat(max(64, min(4096, call.getInt("size") ?? 640)))
        let quality = CGFloat(max(0.3, min(0.95, call.getDouble("quality") ?? 0.8)))
        if ids.isEmpty {
            call.resolve(["images": [String: String]()])
            return
        }

        let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .fast
        options.isNetworkAccessAllowed = true
        options.isSynchronous = false

        var result: [String: String] = [:]
        let lock = NSLock()
        let group = DispatchGroup()
        assets.enumerateObjects { asset, _, _ in
            group.enter()
            PHImageManager.default().requestImage(
                for: asset, targetSize: CGSize(width: size, height: size), contentMode: .aspectFit, options: options
            ) { image, _ in
                guard let image = image else {
                    group.leave()
                    return
                }
                DispatchQueue.global(qos: .userInitiated).async {
                    if let data = image.jpegData(compressionQuality: quality) {
                        lock.lock()
                        result[asset.localIdentifier] = data.base64EncodedString()
                        lock.unlock()
                    }
                    group.leave()
                }
            }
        }
        group.notify(queue: .global(qos: .userInitiated)) {
            call.resolve(["images": result])
        }
    }
}
