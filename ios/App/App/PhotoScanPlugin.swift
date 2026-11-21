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
        CAPPluginMethod(name: "photosBetween", returnType: CAPPluginReturnPromise),
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

    /// One photo's when, where and how good it is to show, kept while scanning to find moments.
    private struct Shot {
        let time: Double // seconds, near local time (UTC moved by the longitude)
        let lat: Double
        let lng: Double
        let id: String
        let favourite: Bool
        let video: Bool
        let score: Double
    }

    /// A few hours in one spot with lots of photos: a concert, a match, a festival, a wedding.
    private struct Moment {
        var start: Double
        var end: Double
        var latSum: Double
        var lngSum: Double
        var count: Int
        var videos: Int
        var favourites: Int
        var shots: [(String, Double)]
        var lat: Double { latSum / Double(count) }
        var lng: Double { lngSum / Double(count) }
    }

    /// Every photo and video with a place and a date, summed up per day and
    /// place (about 5 km squares), and the moments: several photos within a
    /// few hundred metres and a few hours of each other (build 13 on).
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
            let stamp = DateFormatter()
            stamp.calendar = Calendar(identifier: .gregorian)
            stamp.locale = Locale(identifier: "en_US_POSIX")
            stamp.timeZone = TimeZone(identifier: "UTC")
            stamp.dateFormat = "yyyy-MM-dd'T'HH:mm"

            var places: [String: Place] = [:]
            var shots: [Shot] = []
            shots.reserveCapacity(total)
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
                // A place that isn't where you were (build 14 on): taken from
                // a plane (high up, or fast), or a rough guess from the phone
                // network (off by kilometres, sometimes across a sea and a border).
                if location.horizontalAccuracy > 1500 { return }
                if location.verticalAccuracy >= 0 && location.altitude > 4500 { return }
                if location.speed > 70 { return }
                located += 1

                // The day where it was taken: UTC moved by the longitude (an
                // hour per 15°), near enough to local time to group trips.
                let local = date.addingTimeInterval(c.longitude * 240)
                let day = format.string(from: local)
                let lat = (c.latitude * 20).rounded() / 20
                let lng = (c.longitude * 20).rounded() / 20
                let key = "\(day)|\(lat)|\(lng)"

                // The picture to show for this day and place: a favourite
                // first, a photo before a video or a screenshot, then the larger.
                let video = asset.mediaType == .video
                let weak = video || asset.mediaSubtypes.contains(.photoScreenshot)
                let score = (asset.isFavorite ? 1000.0 : 0) + (weak ? -500 : 0)
                    + Double(asset.pixelWidth * asset.pixelHeight) / 1e8
                shots.append(Shot(
                    time: local.timeIntervalSince1970, lat: c.latitude, lng: c.longitude, id: asset.localIdentifier,
                    favourite: asset.isFavorite, video: video, score: score
                ))

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

            // Moments: photos close in time (90 minutes at most between two)
            // and place (half a kilometre from the moment's middle).
            shots.sort { $0.time < $1.time }
            var moments: [Moment] = []
            var current: Moment? = nil
            func close() {
                guard let m = current else { return }
                if m.count >= 6 && m.end - m.start >= 25 * 60 { moments.append(m) }
                current = nil
            }
            for s in shots {
                if var m = current {
                    let dLat = (s.lat - m.lat) * 111.0
                    let dLng = (s.lng - m.lng) * 111.0 * cos(m.lat * .pi / 180)
                    if s.time - m.end <= 90 * 60 && (dLat * dLat + dLng * dLng) <= 0.25 {
                        m.end = s.time
                        m.latSum += s.lat
                        m.lngSum += s.lng
                        m.count += 1
                        if s.video { m.videos += 1 }
                        if s.favourite { m.favourites += 1 }
                        m.shots.append((s.id, s.score))
                        current = m
                        continue
                    }
                    close()
                }
                current = Moment(
                    start: s.time, end: s.time, latSum: s.lat, lngSum: s.lng, count: 1,
                    videos: s.video ? 1 : 0, favourites: s.favourite ? 1 : 0, shots: [(s.id, s.score)]
                )
            }
            close()

            let outPlaces: [[String: Any]] = places.values.map { p in
                [
                    "d": p.day,
                    "la": p.latSum / Double(p.count),
                    "ln": p.lngSum / Double(p.count),
                    "n": p.count,
                    "f": p.favourites,
                    "a": p.best,
                ]
            }
            let outMoments: [[String: Any]] = moments.map { m in
                // The best few to show, best first (that one is the cover).
                let best = m.shots.sorted { $0.1 > $1.1 }.prefix(6).map { $0.0 }
                return [
                    "s": stamp.string(from: Date(timeIntervalSince1970: m.start)),
                    "e": stamp.string(from: Date(timeIntervalSince1970: m.end)),
                    "la": m.lat,
                    "ln": m.lng,
                    "n": m.count,
                    "v": m.videos,
                    "f": m.favourites,
                    "a": best,
                ]
            }
            call.resolve(["total": total, "located": located, "places": outPlaces, "moments": outMoments])
        }
    }

    /// The photos taken on the given days (yyyy-MM-dd, local to where each
    /// was taken), oldest first: for adding a trip's or an event's own photos
    /// straight from its days (build 15 on). Photos only, no screenshots.
    @objc func photosBetween(_ call: CAPPluginCall) {
        guard let fromDay = call.getString("from"), let toDay = call.getString("to") else {
            call.reject("from and to are needed")
            return
        }
        let limit = max(1, min(2000, call.getInt("limit") ?? 600))
        DispatchQueue.global(qos: .userInitiated).async {
            let day = DateFormatter()
            day.calendar = Calendar(identifier: .gregorian)
            day.locale = Locale(identifier: "en_US_POSIX")
            day.timeZone = TimeZone(identifier: "UTC")
            day.dateFormat = "yyyy-MM-dd"
            let stamp = DateFormatter()
            stamp.calendar = Calendar(identifier: .gregorian)
            stamp.locale = Locale(identifier: "en_US_POSIX")
            stamp.timeZone = TimeZone(identifier: "UTC")
            stamp.dateFormat = "yyyy-MM-dd'T'HH:mm"
            guard let from = day.date(from: fromDay), let to = day.date(from: toDay) else {
                call.reject("Dates are yyyy-MM-dd")
                return
            }
            // A day on either side: local time can be up to 14 hours from UTC.
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
            options.predicate = NSPredicate(
                format: "mediaType == %d AND creationDate >= %@ AND creationDate < %@",
                PHAssetMediaType.image.rawValue, from.addingTimeInterval(-86_400) as NSDate, to.addingTimeInterval(2 * 86_400) as NSDate
            )
            options.includeAssetSourceTypes = [.typeUserLibrary, .typeiTunesSynced]
            let assets = PHAsset.fetchAssets(with: options)
            let offsetHere = Double(TimeZone.current.secondsFromGMT())
            var out: [[String: Any]] = []
            assets.enumerateObjects { asset, _, stop in
                guard let date = asset.creationDate, !asset.mediaSubtypes.contains(.photoScreenshot) else { return }
                // Local to where it was taken (by longitude), or to this phone when it has no place.
                let c = asset.location?.coordinate
                let local = date.addingTimeInterval(c.map { $0.longitude * 240 } ?? offsetHere)
                let d = day.string(from: local)
                guard d >= fromDay && d <= toDay else { return }
                var item: [String: Any] = ["id": asset.localIdentifier, "t": stamp.string(from: local), "f": asset.isFavorite]
                if let c = c, CLLocationCoordinate2DIsValid(c) {
                    item["la"] = c.latitude
                    item["ln"] = c.longitude
                }
                out.append(item)
                if out.count >= limit { stop.pointee = true }
            }
            call.resolve(["photos": out])
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
