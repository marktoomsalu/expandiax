import SwiftUI

// The sheet: the trip these belong to already picked, one tap to add.

private extension Color {
    static let pink = Color(red: 250 / 255, green: 81 / 255, blue: 162 / 255)
    static let orange = Color(red: 251 / 255, green: 120 / 255, blue: 34 / 255)
    static let canvas = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 10 / 255, green: 14 / 255, blue: 19 / 255, alpha: 1) : UIColor(red: 250 / 255, green: 249 / 255, blue: 246 / 255, alpha: 1) })
    static let card = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 19 / 255, green: 24 / 255, blue: 31 / 255, alpha: 1) : .white })
    static let line = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 38 / 255, green: 45 / 255, blue: 55 / 255, alpha: 1) : UIColor(red: 228 / 255, green: 228 / 255, blue: 231 / 255, alpha: 1) })
    static let softPink = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 74 / 255, green: 24 / 255, blue: 48 / 255, alpha: 1) : UIColor(red: 253 / 255, green: 242 / 255, blue: 248 / 255, alpha: 1) })
}

private let brand = LinearGradient(colors: [.pink, .orange], startPoint: .topLeading, endPoint: .bottomTrailing)

private func serif(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    .system(size: size, weight: weight, design: .serif)
}

private func tripDates(_ t: ShareTrip) -> String {
    let when = tripDays(t)
    return t.kind == "lived" ? "Lived here · \(when)" : when
}

private func tripDays(_ t: ShareTrip) -> String {
    guard let from = t.from, let a = ShareModel.date(from) else { return String(t.year) }
    let b = t.to.flatMap(ShareModel.date) ?? a
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.timeZone = TimeZone(identifier: "UTC")
    if t.precision == "month" {
        f.dateFormat = "MMMM yyyy"
        return f.string(from: a)
    }
    return rangeText(a, b, f)
}

private func rangeText(_ a: Date, _ b: Date, _ f: DateFormatter = DateFormatter()) -> String {
    f.locale = Locale(identifier: "en_GB")
    f.timeZone = TimeZone(identifier: "UTC")
    let cal = Calendar(identifier: .gregorian)
    var utc = cal
    utc.timeZone = TimeZone(identifier: "UTC")!
    if utc.isDate(a, inSameDayAs: b) {
        f.dateFormat = "d MMM yyyy"
        return f.string(from: a)
    }
    let sameYear = utc.component(.year, from: a) == utc.component(.year, from: b)
    let sameMonth = sameYear && utc.component(.month, from: a) == utc.component(.month, from: b)
    f.dateFormat = sameMonth ? "d" : sameYear ? "d MMM" : "d MMM yyyy"
    let start = f.string(from: a)
    f.dateFormat = "d MMM yyyy"
    return "\(start)–\(f.string(from: b))"
}

private func eventDate(_ e: ShareEvent) -> String {
    guard let d = ShareModel.date(e.date) else { return e.date }
    if let end = e.endDate.flatMap(ShareModel.date), end > d { return rangeText(d, end) }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "d MMM yyyy"
    return f.string(from: d)
}

/** An event's kind as a symbol: a note for a concert, a ball for a match. */
private func eventSymbol(_ type: String) -> String {
    switch type {
    case "concert": return "music.note"
    case "festival": return "sparkles"
    case "sport": return "sportscourt"
    case "conference": return "person.3"
    case "personal": return "heart"
    default: return "ticket"
    }
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    @State private var search = ""
    @State private var pickingCountry = false
    /// Whose country the picker sets: the new trip's or the new event's.
    @State private var countryForEvent = false
    enum Tab { case trips, events }
    @State private var tab: Tab?

    var body: some View {
        ZStack {
            Color.canvas.ignoresSafeArea()
            // The brand's glow at the top, as in the app.
            GeometryReader { geo in
                Circle().fill(Color.pink.opacity(0.22)).frame(width: 320).blur(radius: 60).offset(x: -90, y: -150)
                Circle().fill(Color.orange.opacity(0.18)).frame(width: 280).blur(radius: 60).offset(x: geo.size.width - 180, y: -110)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                topBar
                switch model.phase {
                case .loading: loading
                case .signedOut: signedOut
                case .choosing: choosing
                case .sending, .done: sending
                case .failed(let message): failed(message)
                }
            }
        }
        .sheet(isPresented: $pickingCountry) { countryPicker }
    }

    // MARK: Parts

    private var topBar: some View {
        HStack {
            Button("Cancel") { model.cancel() }
                .foregroundColor(.secondary)
                .frame(minWidth: 60, minHeight: 44, alignment: .leading)
            Spacer()
            (Text("Expandia").foregroundColor(.orange) + Text("X").foregroundColor(.pink).fontWeight(.semibold))
                .font(serif(19))
                .accessibilityLabel("ExpandiaX")
            Spacer()
            Color.clear.frame(width: 60, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
    }

    private var header: some View {
        HStack(spacing: 14) {
            ZStack {
                ForEach(Array(model.items.prefix(3).enumerated().reversed()), id: \.offset) { i, item in
                    thumb(item.thumb)
                        .frame(width: 56, height: 56)
                        .rotationEffect(.degrees(i == 0 ? -2 : i == 1 ? 9 : -10))
                        .offset(x: i == 0 ? 0 : i == 1 ? 16 : -14, y: i == 0 ? 0 : 6)
                }
            }
            .frame(width: 88, height: 70)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(model.items.count) \(model.items.count == 1 ? "memory" : "memories")").font(serif(26))
                Text(summary).font(.subheadline).foregroundColor(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private var summary: String {
        var parts: [String] = []
        if model.photoCount > 0 { parts.append("\(model.photoCount) \(model.photoCount == 1 ? "photo" : "photos")") }
        if model.videoCount > 0 { parts.append("\(model.videoCount) \(model.videoCount == 1 ? "video" : "videos")") }
        if let a = model.days.first.flatMap(ShareModel.date), let b = model.days.last.flatMap(ShareModel.date) { parts.append(rangeText(a, b)) }
        return parts.joined(separator: " · ")
    }

    private func thumb(_ image: UIImage?) -> some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color.line
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.white, lineWidth: 2.5))
        .shadow(color: .black.opacity(0.25), radius: 6, y: 4)
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(2)
            .foregroundColor(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 22)
            .padding(.bottom, 8)
    }

    private func radio(_ on: Bool) -> some View {
        ZStack {
            Circle().stroke(on ? Color.pink : Color.line, lineWidth: 2).frame(width: 24, height: 24)
            if on { Circle().fill(brand).frame(width: 14, height: 14) }
        }
    }

    // MARK: Choosing

    private var choosing: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    header
                    if model.bestEvent != nil || model.best != nil || model.lived != nil {
                        label("They're from")
                        VStack(spacing: 10) {
                            if let e = model.bestEvent { eventCard(e) }
                            if let best = model.best { bestCard(best) }
                            if let lived = model.lived, lived.visitId != model.best?.visitId { bestCard(lived) }
                        }
                    }
                    label(model.best == nil && model.bestEvent == nil && model.lived == nil ? "Add to" : "Or")
                    VStack(spacing: 10) {
                        newTripCard
                        newEventCard
                    }
                    library
                }
                .padding(.bottom, 24)
            }
            bottom
        }
    }

    private func bestCard(_ t: ShareTrip) -> some View {
        let on = model.choice == .trip(t.visitId)
        return Button { model.choice = .trip(t.visitId) } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(brand)
                    Text(ShareModel.flag(t.code)).font(.system(size: 30))
                }
                .frame(width: 58, height: 70)
                VStack(alignment: .leading, spacing: 3) {
                    Text(t.name).font(serif(20)).foregroundColor(.primary)
                    Text(tripDates(t)).font(.subheadline).foregroundColor(.primary)
                    if !t.places.isEmpty {
                        Text(t.places.joined(separator: " · ")).font(.footnote).foregroundColor(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                radio(on)
            }
            .padding(12)
            .background(Color.card)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(on ? Color.pink : Color.line, lineWidth: on ? 2 : 1))
            .shadow(color: Color.pink.opacity(on ? 0.25 : 0), radius: 14, y: 8)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func eventCard(_ e: ShareEvent) -> some View {
        let on = model.choice == .event(e.eventId)
        return Button { model.choice = .event(e.eventId) } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 43 / 255, green: 11 / 255, blue: 46 / 255))
                    Image(systemName: eventSymbol(e.type)).font(.system(size: 24, weight: .semibold)).foregroundStyle(brand)
                }
                .frame(width: 58, height: 70)
                VStack(alignment: .leading, spacing: 3) {
                    Text(e.title).font(serif(20)).foregroundColor(.primary).lineLimit(2)
                    Text(eventDate(e)).font(.subheadline).foregroundColor(.primary)
                    let place = [e.venue, e.city].compactMap { $0 }.joined(separator: ", ")
                    if !place.isEmpty {
                        Text(place).font(.footnote).foregroundColor(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                radio(on)
            }
            .padding(12)
            .background(Color.card)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(on ? Color.pink : Color.line, lineWidth: on ? 2 : 1))
            .shadow(color: Color.pink.opacity(on ? 0.25 : 0), radius: 14, y: 8)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// Everything else they could add to: trips or events, one switch away, one search for both.
    private var library: some View {
        let current = tab ?? (model.bestEvent != nil ? .events : .trips)
        return VStack(spacing: 0) {
            if model.events.isEmpty {
                label("Your trips")
            } else {
                Picker("Show", selection: Binding(get: { current }, set: { tab = $0 })) {
                    Text("Trips").tag(Tab.trips)
                    Text("Events").tag(Tab.events)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 22)
                .padding(.bottom, 10)
            }
            if model.trips.count + model.events.count > 6 {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                    TextField(current == .events ? "Search your events" : "Search your trips", text: $search)
                        .textInputAutocapitalization(.words)
                        .disableAutocorrection(true)
                }
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(Color.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Color.line))
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
            if current == .events { otherEvents } else { otherTrips }
        }
    }

    private var otherEvents: some View {
        let others = model.events.filter { $0.eventId != model.bestEvent?.eventId }
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = (q.isEmpty ? others : others.filter { "\($0.title) \($0.venue ?? "") \($0.city ?? "")".lowercased().contains(q) }).prefix(40)
        return VStack(spacing: 0) {
            if !shown.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.eventId) { i, e in
                        let on = model.choice == .event(e.eventId)
                        if i > 0 { Divider().background(Color.line).padding(.leading, 62) }
                        Button { model.choice = .event(e.eventId) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: eventSymbol(e.type)).font(.system(size: 17, weight: .semibold)).foregroundColor(.pink).frame(width: 36, height: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(e.title).foregroundColor(.primary).lineLimit(1)
                                    Text([eventDate(e), e.city].compactMap { $0 }.joined(separator: " · ")).font(.footnote).foregroundColor(.secondary)
                                }
                                Spacer()
                                radio(on)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .background(Color.card)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.line))
                .padding(.horizontal, 16)
            }
        }
    }

    private static let eventTypes: [(type: String, label: String)] = [
        ("concert", "Concert"), ("festival", "Festival"), ("sport", "Sport"), ("conference", "Conference"), ("personal", "Personal"), ("other", "Other"),
    ]

    private var namePrompt: String {
        switch model.evType {
        case "concert": return "Artist or band"
        case "festival": return "Festival name"
        case "sport": return "Match, race or game"
        case "conference": return "Conference name"
        case "personal": return "A wedding, a birthday…"
        default: return "What was it?"
        }
    }

    /// A new event: what was on there, filled in when it can be found; type, name, day(s), place.
    private var newEventCard: some View {
        let on = model.choice == .newEvent
        let guess = [model.evTitle, model.evVenue].filter { !$0.isEmpty }.joined(separator: " · ")
        return VStack(spacing: 0) {
            Button { model.choice = .newEvent } label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Color(red: 43 / 255, green: 11 / 255, blue: 46 / 255))
                        Image(systemName: eventSymbol(model.evType)).font(.system(size: 16, weight: .bold)).foregroundStyle(brand)
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A new event").font(.body.weight(.medium)).foregroundColor(.primary)
                        if !on, !guess.isEmpty {
                            Text(guess).font(.footnote).foregroundColor(.secondary).lineLimit(1)
                        } else if !on, model.evGuessing {
                            Text("Looking up what was on…").font(.footnote).foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                    radio(on)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if on {
                Divider().background(Color.line)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Self.eventTypes, id: \.type) { t in
                            let picked = model.evType == t.type
                            Button {
                                model.evType = t.type
                                if t.type == "concert" { model.evMulti = false }
                            } label: {
                                Label(t.label, systemImage: eventSymbol(t.type))
                                    .font(.subheadline.weight(picked ? .semibold : .regular))
                                    .foregroundColor(picked ? .pink : .primary)
                                    .padding(.horizontal, 12)
                                    .frame(height: 36)
                                    .background(Capsule().fill(picked ? Color.softPink : Color.clear))
                                    .overlay(Capsule().stroke(picked ? Color.pink : Color.line))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(picked ? .isSelected : [])
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                }
                Divider().background(Color.line)
                HStack {
                    Image(systemName: "pencil").foregroundColor(.pink).frame(width: 24)
                    TextField(namePrompt, text: $model.evTitle).textInputAutocapitalization(.words)
                    if model.evGuessing { ProgressView().scaleEffect(0.8) }
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                Divider().background(Color.line)
                VStack(spacing: 6) {
                    HStack {
                        Image(systemName: "calendar").foregroundColor(.pink).frame(width: 24)
                        DatePicker(model.evMulti ? "First day" : "Date", selection: $model.evFrom, displayedComponents: .date).labelsHidden()
                        if model.evMulti {
                            Text("–").foregroundColor(.secondary)
                            DatePicker("Last day", selection: $model.evTo, in: model.evFrom..., displayedComponents: .date).labelsHidden()
                        }
                        Spacer(minLength: 0)
                    }
                    // A festival, a conference, a tournament: easy to make it several days. A concert: one night.
                    if model.evType != "concert" || model.evMulti {
                        Toggle("Multiple days", isOn: $model.evMulti)
                            .font(.subheadline)
                            .tint(.pink)
                            .padding(.leading, 32)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                Divider().background(Color.line)
                HStack {
                    Image(systemName: "mappin.and.ellipse").foregroundColor(.orange).frame(width: 24)
                    TextField("Venue (optional)", text: $model.evVenue).textInputAutocapitalization(.words)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                Divider().background(Color.line)
                HStack {
                    Image(systemName: "building.2").foregroundColor(.orange).frame(width: 24)
                    TextField("City", text: $model.evCity).textInputAutocapitalization(.words)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                Divider().background(Color.line)
                Button { countryForEvent = true; pickingCountry = true } label: {
                    HStack {
                        Image(systemName: "globe.europe.africa").foregroundColor(.pink).frame(width: 24)
                        if let code = model.evCode, let name = ShareModel.countryName(code) {
                            Text("\(ShareModel.flag(code)) \(name)").foregroundColor(.primary)
                        } else {
                            Text("Choose the country").foregroundColor(.pink)
                        }
                        Spacer()
                        Text(model.evCode == nil ? "" : "Change").font(.subheadline.weight(.semibold)).foregroundColor(.pink)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(on ? Color.pink : Color.line, lineWidth: on ? 2 : 1))
        .padding(.horizontal, 16)
        .onChange(of: model.evMulti) { multi in
            if multi, model.evTo <= model.evFrom { model.evTo = model.evFrom.addingTimeInterval(86_400) }
        }
    }

    private var newTripCard: some View {
        let on = model.choice == .newTrip
        return VStack(spacing: 0) {
            Button { model.choice = .newTrip } label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(brand)
                        Image(systemName: "plus").font(.system(size: 17, weight: .bold)).foregroundColor(.white)
                    }
                    .frame(width: 38, height: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A new trip").font(.body.weight(.medium)).foregroundColor(.primary)
                        if !on, let code = model.newCode, let name = ShareModel.countryName(code) {
                            Text("\(ShareModel.flag(code)) \(name)").font(.footnote).foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                    radio(on)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if on {
                Divider().background(Color.line)
                Button { countryForEvent = false; pickingCountry = true } label: {
                    HStack {
                        Image(systemName: "globe.europe.africa").foregroundColor(.pink).frame(width: 24)
                        if let code = model.newCode, let name = ShareModel.countryName(code) {
                            Text("\(ShareModel.flag(code)) \(name)").foregroundColor(.primary)
                        } else {
                            Text("Choose the country").foregroundColor(.pink)
                        }
                        Spacer()
                        Text(model.newCode == nil ? "" : "Change").font(.subheadline.weight(.semibold)).foregroundColor(.pink)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                }
                .buttonStyle(.plain)
                Divider().background(Color.line)
                HStack {
                    Image(systemName: "calendar").foregroundColor(.pink).frame(width: 24)
                    DatePicker("From", selection: $model.newFrom, displayedComponents: .date).labelsHidden()
                    Text("–").foregroundColor(.secondary)
                    DatePicker("To", selection: $model.newTo, in: model.newFrom..., displayedComponents: .date).labelsHidden()
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 52)
                .environment(\.timeZone, TimeZone(identifier: "UTC")!)
                if !model.newPlaces.isEmpty {
                    Divider().background(Color.line)
                    HStack(alignment: .top) {
                        Image(systemName: "mappin.and.ellipse").foregroundColor(.orange).frame(width: 24)
                        Text(model.newPlaces.map(\.name).joined(separator: " · ")).font(.subheadline).foregroundColor(.primary)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                }
            }
        }
        .background(Color.card)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(on ? Color.pink : Color.line, lineWidth: on ? 2 : 1))
        .padding(.horizontal, 16)
    }

    private var otherTrips: some View {
        let others = model.trips.filter { $0.visitId != model.best?.visitId && $0.visitId != model.lived?.visitId }
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = (q.isEmpty ? others : others.filter { $0.name.lowercased().contains(q) || $0.places.joined(separator: " ").lowercased().contains(q) }).prefix(40)
        return VStack(spacing: 0) {
            if !others.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.visitId) { i, t in
                        let on = model.choice == .trip(t.visitId)
                        if i > 0 { Divider().background(Color.line).padding(.leading, 62) }
                        Button { model.choice = .trip(t.visitId) } label: {
                            HStack(spacing: 12) {
                                Text(ShareModel.flag(t.code)).font(.system(size: 24)).frame(width: 36, height: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(t.name).foregroundColor(.primary)
                                    Text(tripDates(t)).font(.footnote).foregroundColor(.secondary)
                                }
                                Spacer()
                                radio(on)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .background(Color.card)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.line))
                .padding(.horizontal, 16)
            }
        }
    }

    private var addLabel: String {
        switch model.choice {
        case .trip: return "Add to \(model.chosenTrip?.name ?? "this trip")"
        case .event: return "Add to \(model.chosenEvent?.title ?? "this event")"
        case .newTrip: return model.newCode == nil ? "Choose the country" : "Create the trip"
        case .newEvent:
            if model.evTitle.trimmingCharacters(in: .whitespaces).isEmpty { return "Name the event" }
            return model.evCode == nil ? "Choose the country" : "Create the event"
        case nil: return "Choose a trip"
        }
    }

    private var bottom: some View {
        VStack(spacing: 8) {
            if let note = model.roomNote {
                Text(note).font(.footnote).foregroundColor(.secondary).multilineTextAlignment(.center).padding(.horizontal, 12)
            }
            Button {
                if model.choice == .newTrip, model.newCode == nil { countryForEvent = false; pickingCountry = true; return }
                if model.choice == .newEvent, model.evCode == nil, !model.evTitle.isEmpty { countryForEvent = true; pickingCountry = true; return }
                Task { await model.add() }
            } label: {
                Text(addLabel)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(Capsule().fill(Color.pink))
                    .shadow(color: Color.pink.opacity(0.5), radius: 14, y: 8)
            }
            .disabled(model.choice == nil)
            .opacity(model.choice == nil ? 0.5 : 1)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(Color.canvas.opacity(0.96).ignoresSafeArea())
    }

    // MARK: Other states

    private var loading: some View {
        VStack(spacing: 14) {
            Spacer()
            ProgressView().scaleEffect(1.2).tint(.pink)
            Text("Getting your photos ready").foregroundColor(.secondary)
            Spacer()
        }
    }

    private var signedOut: some View {
        VStack(spacing: 14) {
            Spacer()
            ZStack {
                Circle().fill(Color.softPink).frame(width: 80, height: 80)
                Image(systemName: "person.crop.circle.badge.checkmark").font(.system(size: 34)).foregroundColor(.pink)
            }
            Text("Sign in to ExpandiaX first").font(serif(26)).multilineTextAlignment(.center)
            Text("Open ExpandiaX on this phone and sign in once. After that, photos go straight from here to your trips.")
                .foregroundColor(.secondary).multilineTextAlignment(.center).padding(.horizontal, 28)
            Spacer()
            Button { model.cancel() } label: {
                Text("OK").font(.system(size: 17, weight: .semibold)).foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 56).background(Capsule().fill(Color.pink))
            }
            .padding(16)
        }
    }

    private func failed(_ message: String) -> some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "wifi.exclamationmark").font(.system(size: 36)).foregroundColor(.pink)
            Text(message).multilineTextAlignment(.center).padding(.horizontal, 28)
            Spacer()
            Button { Task { await model.retry() } } label: {
                Text("Try again").font(.system(size: 17, weight: .semibold)).foregroundColor(.white)
                    .frame(maxWidth: .infinity, minHeight: 56).background(Capsule().fill(Color.pink))
            }
            .padding(16)
        }
    }

    private var sending: some View {
        let done: String? = { if case .done(let s) = model.phase { return s }; return nil }()
        let place = done ?? (model.choice == .newTrip ? ShareModel.countryName(model.newCode) : model.choice == .newEvent ? model.evTitle : model.chosenEvent?.title ?? model.chosenTrip?.name) ?? "your trip"
        return VStack(spacing: 0) {
            Spacer()
            ZStack(alignment: .bottom) {
                ZStack {
                    ForEach(Array(model.items.prefix(3).enumerated().reversed()), id: \.offset) { i, item in
                        thumb(item.thumb)
                            .frame(width: 80, height: 80)
                            .rotationEffect(.degrees(i == 0 ? 0 : i == 1 ? 11 : -12))
                            .offset(x: i == 0 ? 0 : i == 1 ? 40 : -40, y: i == 0 ? 0 : 12)
                    }
                }
                .frame(width: 170, height: 110)
                ZStack {
                    Circle().fill(brand).frame(width: 50, height: 50)
                    if done != nil {
                        Image(systemName: "checkmark").font(.system(size: 22, weight: .heavy)).foregroundColor(.white).transition(.scale)
                    } else {
                        ProgressView().tint(.white)
                    }
                }
                .overlay(Circle().stroke(Color.canvas, lineWidth: 3))
                .offset(y: 22)
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.6), value: done)
            Group {
                if let done, done.contains("didn't") {
                    Text("Added.").font(serif(30))
                    Text(done).foregroundColor(.secondary)
                } else if done != nil {
                    (Text("Added to ") + Text(place).italic().foregroundColor(.pink) + Text(".")).font(serif(30))
                } else {
                    (Text("On their way to ") + Text(place).italic().foregroundColor(.pink) + Text(".")).font(serif(30))
                }
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)
            .padding(.top, 44)
            ProgressView(value: done != nil ? 1 : max(model.progress, 0.05))
                .tint(.pink)
                .frame(width: 220)
                .padding(.top, 26)
            Spacer()
        }
    }

    private var countryPicker: some View {
        CountryPicker(selected: countryForEvent ? model.evCode : model.newCode) { code in
            if countryForEvent {
                model.evCode = code
                model.choice = .newEvent
            } else {
                model.newCode = code
                model.choice = .newTrip
            }
            pickingCountry = false
        }
    }
}

private struct CountryPicker: View {
    let selected: String?
    let pick: (String) -> Void
    @State private var q = ""

    var body: some View {
        NavigationView {
            List {
                ForEach(ShareModel.allCountries.filter { q.isEmpty || $0.name.lowercased().contains(q.lowercased()) }, id: \.code) { c in
                    Button { pick(c.code) } label: {
                        HStack {
                            Text("\(ShareModel.flag(c.code))  \(c.name)").foregroundColor(.primary)
                            Spacer()
                            if c.code == selected { Image(systemName: "checkmark").foregroundColor(.pink) }
                        }
                    }
                }
            }
            .searchable(text: $q, prompt: "Where were you?")
            .navigationTitle("Country")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
