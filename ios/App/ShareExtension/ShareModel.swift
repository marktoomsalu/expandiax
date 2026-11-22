import Foundation
import UIKit
import UniformTypeIdentifiers
import ImageIO
import AVFoundation
import CoreLocation

// Share to ExpandiaX: what was shared, which trip it belongs to, and sending
// it. Built for speed: the moment the sheet opens, the photos are made small
// (and their location data dropped) on the phone and start uploading, while
// the person is still looking at the sheet. "Add" then only has to attach
// them to the trip. Cancel takes back anything already sent.

struct ShareTrip: Decodable, Identifiable, Hashable {
    let visitId: String
    let code: String
    let name: String
    let from: String?
    let to: String?
    let year: Int
    let precision: String
    /// "lived": months or years there. Never picked by itself: a trip while living there is a trip of its own.
    let kind: String?
    let places: [String]
    let photos: Int
    let videos: Int
    var id: String { visitId }
}

struct ShareEvent: Decodable, Identifiable, Hashable {
    let eventId: String
    let title: String
    let date: String
    let endDate: String?
    let type: String
    let venue: String?
    let city: String?
    let code: String?
    let photos: Int
    let videos: Int
    var id: String { eventId }
}

private struct TripsResponse: Decodable {
    struct Caps: Decodable { let photos: Int; let videos: Int }
    let trips: [ShareTrip]
    let events: [ShareEvent]?
    let caps: Caps
    let homeCode: String?
}

struct NewTripPlace: Encodable, Hashable {
    let name: String
    let lat: Double
    let lng: Double
}

enum Choice: Hashable {
    case trip(String)
    case event(String)
    case newTrip
    case newEvent
}

struct SharedItem: Identifiable {
    enum Kind: String { case image, video }
    let id = UUID()
    let kind: Kind
    /// The file as shared (copied out of the share).
    let source: URL
    let takenAt: Date?
    /// yyyy-mm-dd where it was taken (its own local day).
    let day: String?
    let location: CLLocation?
    var thumb: UIImage?
    var path: String?
    var uploadURL: URL?
    var uploaded = false
    var failed = false
}

@MainActor
final class ShareModel: ObservableObject {
    enum Phase: Equatable {
        case loading
        case signedOut
        case choosing
        case sending
        case done(String)
        case failed(String)
    }

    @Published var phase: Phase = .loading
    @Published var items: [SharedItem] = []
    @Published var trips: [ShareTrip] = []
    @Published var best: ShareTrip?
    @Published var events: [ShareEvent] = []
    /// An event these were all taken at (a concert, a match): offered first, the trip right after.
    @Published var bestEvent: ShareEvent?
    /// The stay they lived in, when these are from it: offered (a day out from home), never merged into a new trip.
    @Published var lived: ShareTrip?

    // A new event, filled in from the photos where it can be: what was on at that venue that day.
    @Published var evType = "other"
    @Published var evTitle = ""
    @Published var evVenue = ""
    @Published var evCity = ""
    @Published var evCode: String?
    @Published var evMulti = false
    @Published var evFrom = Date()
    @Published var evTo = Date()
    @Published var evGuessing = false
    @Published var choice: Choice?
    @Published var newCode: String?
    @Published var newFrom = Date()
    @Published var newTo = Date()
    @Published var newPlaces: [NewTripPlace] = []
    @Published var progress: Double = 0
    @Published var caps = (photos: 15, videos: 8)

    private let context: NSExtensionContext?
    private let server = URL(string: (Bundle.main.object(forInfoDictionaryKey: "ExpandiaXServer") as? String) ?? "https://expandiax.com")!
    private var key: ShareKeychain.Key?
    private var uploading: Task<Void, Never>?
    private let work = FileManager.default.temporaryDirectory.appendingPathComponent("share-\(UUID().uuidString)", isDirectory: true)
    var onClose: (() -> Void)?

    init(context: NSExtensionContext?) {
        self.context = context
    }

    // MARK: - Starting

    func start() async {
        guard let key = ShareKeychain.read() else {
            phase = .signedOut
            return
        }
        self.key = key
        try? FileManager.default.createDirectory(at: work, withIntermediateDirectories: true)

        async let tripsLoaded = loadTrips()
        let shared = await loadItems()
        items = shared
        guard !items.isEmpty else {
            phase = .failed("Photos and videos only, please.")
            return
        }
        // Uploading starts now, while they look; the trip comes later.
        uploading = Task { await uploadAll() }

        let ok = await tripsLoaded
        if !ok {
            if phase != .signedOut { phase = .failed("Couldn't reach ExpandiaX. Check the connection and try again.") }
            return
        }
        guessDates()
        best = bestTrip()
        bestEvent = bestEventMatch()
        lived = bestLived(code: nil)
        choice = bestEvent.map { .event($0.eventId) } ?? best.map { .trip($0.visitId) } ?? lived.map { .trip($0.visitId) }
        phase = .choosing
        await guessNewTrip()
        // Where they were, now that it's known: the stay in that country, if any.
        if let code = newCode, lived?.code != code {
            let was = lived
            lived = bestLived(code: code)
            if let was, choice == .trip(was.visitId) { choice = lived.map { .trip($0.visitId) } }
        }
        if choice == nil, newCode != nil { choice = .newTrip }
        await guessNewEvent()
    }

    /// A stay they lived that most of these days fall in (in that country, once it's known).
    private func bestLived(code: String?) -> ShareTrip? {
        let ds = days
        guard !ds.isEmpty else { return nil }
        let today = Self.day(Date())
        var top: (ShareTrip, Int)?
        for t in trips where t.kind == "lived" && (code == nil || t.code == code) {
            guard let from = t.from else { continue }
            let to = t.to ?? today
            let n = ds.filter { $0 >= from && $0 <= to }.count
            if n > 0, n > (top?.1 ?? 0) { top = (t, n) }
        }
        if let top, top.1 * 2 >= ds.count { return top.0 }
        return nil
    }

    /// What these could be as a new event: the busiest day, the venue the photos were taken at, and
    /// what was on there (a concert by setlist, a match, a festival, a conference from our catalogue).
    private func guessNewEvent() async {
        evCode = newCode
        if evCity.isEmpty { evCity = newPlaces.first?.name ?? "" }
        let ds = days
        let counts = Dictionary(grouping: ds, by: { $0 }).mapValues(\.count)
        guard let mainDay = counts.max(by: { $0.value < $1.value || ($0.value == $1.value && $0.key > $1.key) })?.key,
              let main = Self.date(mainDay) else { return }
        evFrom = main
        evTo = ds.last.flatMap(Self.date) ?? main
        let onDay = items.filter { $0.day == mainDay }.compactMap(\.location)
        guard let spot = onDay.first ?? items.compactMap(\.location).first, let code = newCode else { return }
        evGuessing = true
        defer { evGuessing = false }

        // The venues right there (the same list the app uses, from Wikidata).
        var near: [(name: String, aka: [String], metres: Double)] = []
        if let data = try? await request("data/venues/\(code).json"),
           let rows = try? JSONSerialization.jsonObject(with: data) as? [[Any]] {
            for row in rows where row.count >= 3 {
                guard let name = row[0] as? String, let lat = (row[1] as? NSNumber)?.doubleValue, let lng = (row[2] as? NSNumber)?.doubleValue else { continue }
                let m = spot.distance(from: CLLocation(latitude: lat, longitude: lng))
                if m < 600 { near.append((name, (row.count > 4 ? row[4] as? [String] : nil) ?? [], m)) }
            }
            near.sort { $0.metres < $1.metres }
        }
        if evVenue.isEmpty, let v = near.first, v.metres < 350 { evVenue = v.name }

        let ask: [String: Any] = [
            "moments": [[
                "id": "share",
                "day": mainDay,
                "countryCode": code,
                "towns": evCity.isEmpty ? [] : [evCity],
                // Each venue by its other names too ("Olympiastadion"): listings use whichever.
                "venues": Array(NSOrderedSet(array: near.prefix(3).flatMap { [$0.name] + $0.aka.prefix(2) }).array.prefix(6)),
                "area": ["lat": spot.coordinate.latitude, "lng": spot.coordinate.longitude],
            ]],
        ]
        guard let data = try? await request("api/scan/events", method: "POST", body: ask),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let answer = (json["answers"] as? [[String: Any]])?.first else { return }
        guard evTitle.isEmpty else { return }

        let at = { (o: [String: Any]) -> Double? in
            guard let lat = (o["lat"] as? NSNumber)?.doubleValue, let lng = (o["lng"] as? NSNumber)?.doubleValue else { return nil }
            return spot.distance(from: CLLocation(latitude: lat, longitude: lng))
        }
        let names = Set(near.flatMap { [$0.name] + $0.aka }.map { $0.lowercased() })
        // A show listed at the venue the photos were taken at, or right there.
        let shows = (answer["shows"] as? [[String: Any]] ?? []).filter { ($0["atVenue"] as? Bool) == true || (at($0).map { $0 < 600 } ?? false) }
        if let show = shows.max(by: { (($0["songs"] as? NSNumber)?.intValue ?? 0) < (($1["songs"] as? NSNumber)?.intValue ?? 0) }),
           let artist = show["artist"] as? String {
            evType = "concert"
            evTitle = artist
            if let v = show["venue"] as? String, !v.isEmpty { evVenue = v }
            if let c = show["city"] as? String, !c.isEmpty { evCity = c }
            evMulti = false
        } else if let known = (answer["known"] as? [[String: Any]] ?? []).first(where: { k in
            // A match, festival or conference at that place; a race (that day) through the town. A race series with no date: never.
            switch k["kind"] as? String {
            case "race": return (at(k).map { $0 < 5_000 } ?? false)
            case "race_series": return false
            default:
                let byName = (k["venue"] as? String).map { names.contains($0.lowercased()) } ?? false
                return byName || (at(k).map { $0 < 800 } ?? false)
            }
        }), let title = known["title"] as? String {
            let kind = known["kind"] as? String ?? ""
            evType = ["football": "sport", "race": "sport", "race_series": "sport", "festival": "festival", "conference": "conference"][kind]
                ?? (known["eventType"] as? String) ?? "other"
            evTitle = title
            if let v = known["venue"] as? String, !v.isEmpty { evVenue = v }
            if let c = known["city"] as? String, !c.isEmpty { evCity = c }
        } else {
            return
        }
        // Something was on right there: a new event is the likelier home, unless they already have a trip or event for it.
        if choice == nil || choice == .newTrip { choice = .newEvent }
    }

    private func request(_ path: String, method: String = "GET", body: Any? = nil) async throws -> Data {
        var req = URLRequest(url: server.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(key?.token ?? "")", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        req.timeoutInterval = 30
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            phase = .signedOut
            throw URLError(.userAuthenticationRequired)
        }
        guard (200..<300).contains(status) else { throw URLError(.badServerResponse) }
        return data
    }

    private func loadTrips() async -> Bool {
        guard let data = try? await request("api/share/trips"),
              let res = try? JSONDecoder().decode(TripsResponse.self, from: data) else { return false }
        trips = res.trips
        events = res.events ?? []
        caps = (res.caps.photos, res.caps.videos)
        return true
    }

    // MARK: - What was shared

    private func loadItems() async -> [SharedItem] {
        let providers = (context?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        var out: [SharedItem] = []
        for provider in providers.prefix(60) {
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier),
               let url = await copyFile(provider, type: UTType.movie) {
                out.append(await videoItem(url))
            } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
                      let url = await copyFile(provider, type: UTType.image) {
                if let item = imageItem(url) { out.append(item) }
            }
        }
        return out.sorted { ($0.takenAt ?? .distantFuture) < ($1.takenAt ?? .distantFuture) }
    }

    /// The share's own file is only there while it's being handed over: a copy of our own.
    private func copyFile(_ provider: NSItemProvider, type: UTType) async -> URL? {
        await withCheckedContinuation { done in
            provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, _ in
                guard let url else { return done.resume(returning: nil) }
                let copy = self.work.appendingPathComponent(UUID().uuidString + "." + (url.pathExtension.isEmpty ? "bin" : url.pathExtension))
                do {
                    try FileManager.default.copyItem(at: url, to: copy)
                    done.resume(returning: copy)
                } catch {
                    done.resume(returning: nil)
                }
            }
        }
    }

    private nonisolated func imageItem(_ url: URL) -> SharedItem? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] ?? [:]
        let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any] ?? [:]
        var taken: Date?
        var day: String?
        if let stamp = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
            // "2024:05:03 18:22:10": the day as it was there.
            day = String(stamp.prefix(10)).replacingOccurrences(of: ":", with: "-")
            let offset = exif["OffsetTimeOriginal" as CFString] as? String
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.dateFormat = offset != nil ? "yyyy:MM:dd HH:mm:ssZZZZZ" : "yyyy:MM:dd HH:mm:ss"
            taken = f.date(from: stamp + (offset ?? ""))
        }
        var location: CLLocation?
        if let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any],
           var lat = gps[kCGImagePropertyGPSLatitude] as? Double,
           var lng = gps[kCGImagePropertyGPSLongitude] as? Double {
            if (gps[kCGImagePropertyGPSLatitudeRef] as? String) == "S" { lat = -lat }
            if (gps[kCGImagePropertyGPSLongitudeRef] as? String) == "W" { lng = -lng }
            location = CLLocation(latitude: lat, longitude: lng)
        }
        let thumb = CGImageSourceCreateThumbnailAtIndex(src, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 240,
        ] as CFDictionary).map { UIImage(cgImage: $0) }
        return SharedItem(kind: .image, source: url, takenAt: taken, day: day, location: location, thumb: thumb)
    }

    private nonisolated func videoItem(_ url: URL) async -> SharedItem {
        let asset = AVURLAsset(url: url)
        let taken = (try? await asset.load(.creationDate))?.dateValue
        var location: CLLocation?
        if let meta = try? await asset.load(.metadata),
           let item = AVMetadataItem.metadataItems(from: meta, filteredByIdentifier: .quickTimeMetadataLocationISO6709).first ?? AVMetadataItem.metadataItems(from: meta, filteredByIdentifier: .commonIdentifierLocation).first,
           let iso = try? await item.load(.stringValue) {
            location = Self.parseISO6709(iso)
        }
        let gen = AVAssetImageGenerator(asset: asset)
        gen.appliesPreferredTrackTransform = true
        gen.maximumSize = CGSize(width: 240, height: 240)
        let thumb = (try? gen.copyCGImage(at: .zero, actualTime: nil)).map { UIImage(cgImage: $0) }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return SharedItem(kind: .video, source: url, takenAt: taken, day: taken.map { f.string(from: $0) }, location: location, thumb: thumb)
    }

    /// "+59.4370+024.7536+030.000/" → a place.
    private nonisolated static func parseISO6709(_ s: String) -> CLLocation? {
        let scanner = Scanner(string: s)
        guard let lat = scanner.scanDouble(), let lng = scanner.scanDouble() else { return nil }
        return CLLocation(latitude: lat, longitude: lng)
    }

    // MARK: - Which trip

    var days: [String] { items.compactMap(\.day).sorted() }
    var photoCount: Int { items.filter { $0.kind == .image }.count }
    var videoCount: Int { items.filter { $0.kind == .video }.count }

    nonisolated(unsafe) private static let dayFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    nonisolated static func date(_ day: String) -> Date? { dayFormat.date(from: day) }
    nonisolated static func day(_ date: Date) -> String { dayFormat.string(from: date) }
    nonisolated private static func shift(_ day: String, _ by: Int) -> String {
        guard let d = date(day) else { return day }
        return Self.day(d.addingTimeInterval(Double(by) * 86_400))
    }

    /// The trip whose days most of these were taken on (a day's grace either side).
    private func bestTrip() -> ShareTrip? {
        let ds = days
        guard !ds.isEmpty else { return nil }
        var top: (ShareTrip, Int)?
        for t in trips {
            guard let from = t.from, let to = t.to, t.precision != "year", t.kind != "lived" else { continue }
            let lo = Self.shift(from, -1), hi = Self.shift(to, 1)
            let n = ds.filter { $0 >= lo && $0 <= hi }.count
            if n > 0, n > (top?.1 ?? 0) { top = (t, n) }
        }
        if let top, top.1 * 2 >= ds.count { return top.0 }
        return nil
    }

    /// The event most of these were taken at: on its day (or days, for a festival), or the night after (a show past midnight).
    private func bestEventMatch() -> ShareEvent? {
        let ds = days
        guard !ds.isEmpty else { return nil }
        var top: (ShareEvent, Int)?
        for e in events {
            let hi = Self.shift(e.endDate ?? e.date, 1)
            let n = ds.filter { $0 >= e.date && $0 <= hi }.count
            if n > 0, n > (top?.1 ?? 0) { top = (e, n) }
        }
        if let top, top.1 * 2 >= ds.count { return top.0 }
        return nil
    }

    private func guessDates() {
        let ds = days
        if let first = ds.first.flatMap(Self.date), let last = ds.last.flatMap(Self.date) {
            newFrom = first
            newTo = last
        }
    }

    /// A new trip, filled in from the photos: the country and a few places they were taken in.
    private func guessNewTrip() async {
        let located = items.compactMap(\.location)
        guard !located.isEmpty else { return }
        var spots: [CLLocation] = []
        for l in located where !spots.contains(where: { $0.distance(from: l) < 15_000 }) {
            spots.append(l)
            if spots.count == 3 { break }
        }
        let geocoder = CLGeocoder()
        var places: [NewTripPlace] = []
        for spot in spots {
            guard let mark = try? await geocoder.reverseGeocodeLocation(spot).first else { continue }
            if newCode == nil { newCode = mark.isoCountryCode }
            if let town = mark.locality ?? mark.subAdministrativeArea, mark.isoCountryCode == newCode, !places.contains(where: { $0.name == town }) {
                places.append(NewTripPlace(name: town, lat: spot.coordinate.latitude, lng: spot.coordinate.longitude))
            }
        }
        newPlaces = places
        // No trip with those days, but one saved with only a year (or month) there: offer that one.
        if best == nil, let code = newCode, let year = days.first.map({ Int($0.prefix(4)) ?? 0 }),
           let loose = trips.first(where: { $0.code == code && $0.precision != "day" && $0.kind != "lived" && $0.year == year }) {
            best = loose
            if choice == nil { choice = .trip(loose.visitId) }
        }
    }

    var chosenTrip: ShareTrip? {
        if case .trip(let id) = choice { return trips.first { $0.visitId == id } }
        return nil
    }

    var chosenEvent: ShareEvent? {
        if case .event(let id) = choice { return events.first { $0.eventId == id } }
        return nil
    }

    /// "11 of 13 photos fit on this trip": said before, not after.
    var roomNote: String? {
        if let e = chosenEvent {
            let photosRoom = max(0, caps.photos - e.photos), videosRoom = max(0, caps.videos - e.videos)
            if photoCount <= photosRoom && videoCount <= videosRoom { return nil }
            if photosRoom == 0 && videosRoom == 0 { return "This event is full (\(caps.photos) photos, \(caps.videos) videos)." }
            return "Room for \(photosRoom) more \(photosRoom == 1 ? "photo" : "photos") and \(videosRoom) more \(videosRoom == 1 ? "video" : "videos") on this event: the first ones are kept."
        }
        guard let t = chosenTrip else {
            let over = max(0, photoCount - caps.photos) + max(0, videoCount - caps.videos)
            return over > 0 ? "A trip or event holds \(caps.photos) photos and \(caps.videos) videos: the first ones are kept." : nil
        }
        let photosRoom = max(0, caps.photos - t.photos), videosRoom = max(0, caps.videos - t.videos)
        if photoCount <= photosRoom && videoCount <= videosRoom { return nil }
        if photosRoom == 0 && videosRoom == 0 { return "This trip is full (\(caps.photos) photos, \(caps.videos) videos)." }
        var parts: [String] = []
        if photoCount > photosRoom { parts.append("\(photosRoom) more \(photosRoom == 1 ? "photo" : "photos")") }
        if videoCount > videosRoom { parts.append("\(videosRoom) more \(videosRoom == 1 ? "video" : "videos")") }
        return "Room for \(parts.joined(separator: " and ")) on this trip: the first ones are kept."
    }

    // MARK: - Sending

    private func uploadAll() async {
        guard let data = try? await request("api/share/uploads", method: "POST", body: ["kinds": items.map { $0.kind.rawValue }]),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let list = json["items"] as? [[String: Any]], list.count == items.count else {
            for i in items.indices { items[i].failed = true }
            return
        }
        for (i, entry) in list.enumerated() {
            items[i].path = entry["path"] as? String
            items[i].uploadURL = (entry["url"] as? String).flatMap(URL.init(string:))
        }
        // Three at a time.
        let count = items.count
        await withTaskGroup(of: Void.self) { group in
            var next = 0
            while next < min(3, count) {
                let i = next
                group.addTask { await self.upload(i) }
                next += 1
            }
            while await group.next() != nil {
                guard next < count else { continue }
                let i = next
                group.addTask { await self.upload(i) }
                next += 1
            }
        }
    }

    private func upload(_ i: Int) async {
        let item = items[i]
        guard let target = item.uploadURL, !Task.isCancelled else { return }
        let file: URL?
        if item.kind == .image {
            file = await Self.preparePhoto(item.source, into: work)
        } else {
            file = await Self.prepareVideo(item.source, into: work)
        }
        guard let file, !Task.isCancelled else {
            items[i].failed = true
            return
        }
        var req = URLRequest(url: target)
        req.httpMethod = "PUT"
        req.setValue(item.kind == .image ? "image/jpeg" : "video/mp4", forHTTPHeaderField: "Content-Type")
        req.setValue("max-age=3600", forHTTPHeaderField: "Cache-Control")
        req.timeoutInterval = 300
        for attempt in 0..<3 {
            if let (_, response) = try? await URLSession.shared.upload(for: req, fromFile: file),
               ((response as? HTTPURLResponse)?.statusCode ?? 0) < 300 {
                items[i].uploaded = true
                updateProgress()
                return
            }
            try? await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_500_000_000)
        }
        items[i].failed = true
        updateProgress()
    }

    private func updateProgress() {
        let finished = items.filter { $0.uploaded || $0.failed }.count
        progress = items.isEmpty ? 1 : Double(finished) / Double(items.count)
    }

    /// At most 2560 px, as a JPEG, with nothing in it but the picture (no location, no camera details).
    private nonisolated static func preparePhoto(_ url: URL, into dir: URL) async -> URL? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(src, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: 2560,
              ] as CFDictionary) else { return nil }
        let out = dir.appendingPathComponent(UUID().uuidString + ".jpg")
        guard let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out : nil
    }

    /// Full HD at most, without its location: like the app's own picker.
    private nonisolated static func prepareVideo(_ url: URL, into dir: URL) async -> URL? {
        let asset = AVURLAsset(url: url)
        guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1920x1080) else { return nil }
        let out = dir.appendingPathComponent(UUID().uuidString + ".mp4")
        export.outputURL = out
        export.outputFileType = .mp4
        export.shouldOptimizeForNetworkUse = true
        export.metadataItemFilter = .forSharing()
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            export.exportAsynchronously { done.resume() }
        }
        return export.status == .completed ? out : nil
    }

    var canAdd: Bool {
        switch choice {
        case .trip, .event: return true
        case .newTrip: return newCode != nil
        case .newEvent: return evCode != nil && !evTitle.trimmingCharacters(in: .whitespaces).isEmpty
        case nil: return false
        }
    }

    func add() async {
        guard canAdd else { return }
        phase = .sending
        await uploading?.value
        let sent = items.filter { $0.uploaded && $0.path != nil }
        guard !sent.isEmpty else {
            phase = .failed("Those didn't upload. Check the connection and try again.")
            return
        }
        let iso = ISO8601DateFormatter()
        var body: [String: Any] = [
            "items": sent.map { item -> [String: Any] in
                var o: [String: Any] = ["path": item.path!, "kind": item.kind.rawValue]
                if let t = item.takenAt { o["takenAt"] = iso.string(from: t) }
                return o
            },
        ]
        let destination: String
        switch choice {
        case .trip(let id):
            body["visitId"] = id
            destination = trips.first { $0.visitId == id }?.name ?? "your trip"
        case .event(let id):
            body["eventId"] = id
            destination = events.first { $0.eventId == id }?.title ?? "your event"
        case .newEvent:
            let from = Self.day(min(evFrom, evTo)), to = Self.day(max(evFrom, evTo))
            var e: [String: Any] = [
                "type": evType,
                "title": evTitle.trimmingCharacters(in: .whitespaces),
                "date": evMulti ? from : Self.day(evFrom),
                "venue": evVenue,
                "city": evCity,
                "code": evCode ?? "",
            ]
            if evMulti, to > from { e["endDate"] = to }
            body["newEvent"] = e
            destination = evTitle.trimmingCharacters(in: .whitespaces)
        default:
            let from = Self.day(min(newFrom, newTo)), to = Self.day(max(newFrom, newTo))
            body["newTrip"] = [
                "code": newCode ?? "",
                "from": from,
                "to": to,
                "places": newPlaces.map { ["name": $0.name, "lat": $0.lat, "lng": $0.lng] },
            ] as [String: Any]
            destination = Self.countryName(newCode) ?? "your new trip"
        }
        guard let data = try? await request("api/share/finish", method: "POST", body: body),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            phase = .failed("That didn't save. Try again?")
            return
        }
        let skipped = json["skipped"] as? Int ?? 0
        let failed = items.count - sent.count
        let left = skipped + failed
        phase = .done(left > 0 ? "\(left) didn't fit or didn't upload." : destination)
        try? await Task.sleep(nanoseconds: 1_400_000_000)
        finish()
    }

    func retry() async {
        phase = .loading
        uploading?.cancel()
        items = []
        await start()
    }

    func cancel() {
        uploading?.cancel()
        let sent = items.compactMap(\.path)
        if key != nil, !sent.isEmpty {
            // Takes back what was already sent; quick, and the sheet doesn't wait long for it.
            Task {
                _ = try? await request("api/share/cancel", method: "POST", body: ["paths": sent])
            }
        }
        cleanUp()
        context?.cancelRequest(withError: NSError(domain: "com.expandiax.share", code: NSUserCancelledError))
    }

    func finish() {
        cleanUp()
        context?.completeRequest(returningItems: nil)
    }

    private func cleanUp() {
        try? FileManager.default.removeItem(at: work)
    }

    // MARK: - Countries

    nonisolated static func countryName(_ code: String?) -> String? {
        guard let code else { return nil }
        return Locale(identifier: "en_GB").localizedString(forRegionCode: code)
    }

    nonisolated static func flag(_ code: String) -> String {
        code.uppercased().unicodeScalars.compactMap { UnicodeScalar(127_397 + $0.value) }.map(String.init).joined()
    }

    nonisolated(unsafe) static let allCountries: [(code: String, name: String)] = Locale.isoRegionCodes
        .compactMap { code in countryName(code).map { (code, $0) } }
        .filter { !$0.code.allSatisfy(\.isNumber) }
        .sorted { $0.name < $1.name }
}
