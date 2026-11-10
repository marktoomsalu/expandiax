import Foundation
import Capacitor
import MultipeerConnectivity
import NearbyInteraction
import CoreMotion
import UIKit

// Touch globes: two iPhones with ExpandiaX open find each other, measure how
// far apart they are, and notice when they touch.
//
// Native only does the radio work, so the experience itself (what counts as
// a touch, what gets said, what's shown) lives in the website and can change
// without an App Store release:
//
//  - MultipeerConnectivity finds nearby phones running ExpandiaX and opens an
//    encrypted link to each. Peers are named by a random id made for each
//    start, never by anything about the person.
//  - Nearby Interaction (the U1/U2 ultra wideband chip, iPhone 11 and newer)
//    measures the distance to each linked phone, down to centimetres, the
//    same way NameDrop does. Its tokens travel over the Multipeer link.
//  - CoreMotion reports a sharp knock ("bump"), for phones without that chip.
//
// Events: peerConnected, peerLost, message, distance, bump, unavailable.
@objc(GlobeTouchPlugin)
public class GlobeTouchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GlobeTouchPlugin"
    public let jsName = "GlobeTouch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]

    // Must match NSBonjourServices in Info.plist (_expx-touch._tcp / _udp).
    private static let serviceType = "expx-touch"

    // What a packet over the link is: the website's own message, or a
    // Nearby Interaction token for this side's distance session.
    private enum Kind: UInt8 { case message = 0, niToken = 1 }

    private var me: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var nearby: [MCPeerID: NISession] = [:]
    private var lastDistanceSent: [MCPeerID: TimeInterval] = [:]
    private let motion = CMMotionManager()
    private var bumpThreshold = 1.6 // g, beyond gravity
    private var lastBump: TimeInterval = 0

    private var preciseDistance: Bool {
        if #available(iOS 16.0, *) {
            return NISession.deviceCapabilities.supportsPreciseDistanceMeasurement
        }
        return NISession.isSupported
    }

    @objc func capabilities(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "preciseDistance": preciseDistance,
            "motion": motion.isDeviceMotionAvailable
        ])
    }

    @objc func start(_ call: CAPPluginCall) {
        if let threshold = call.getDouble("bumpThreshold") { bumpThreshold = threshold }
        let useMotion = call.getBool("motion") ?? true
        DispatchQueue.main.async {
            self.stopAll()
            let me = MCPeerID(displayName: String(UUID().uuidString.prefix(12)))
            let session = MCSession(peer: me, securityIdentity: nil, encryptionPreference: .required)
            session.delegate = self
            let advertiser = MCNearbyServiceAdvertiser(peer: me, discoveryInfo: nil, serviceType: Self.serviceType)
            advertiser.delegate = self
            let browser = MCNearbyServiceBrowser(peer: me, serviceType: Self.serviceType)
            browser.delegate = self
            self.me = me
            self.session = session
            self.advertiser = advertiser
            self.browser = browser
            advertiser.startAdvertisingPeer()
            browser.startBrowsingForPeers()
            if useMotion { self.startMotion() }
            call.resolve(["id": me.displayName, "preciseDistance": self.preciseDistance])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopAll()
            call.resolve()
        }
    }

    /// Sends the website's message (a string) to one peer, or to every linked peer.
    @objc func send(_ call: CAPPluginCall) {
        guard let text = call.getString("data") else {
            call.reject("Nothing to send.")
            return
        }
        DispatchQueue.main.async {
            guard let session = self.session else {
                call.reject("Not started.")
                return
            }
            let target = call.getString("peerId")
            let peers = session.connectedPeers.filter { target == nil || $0.displayName == target }
            if peers.isEmpty {
                call.reject("That phone isn't linked.")
                return
            }
            do {
                try session.send(self.packet(.message, Data(text.utf8)), toPeers: peers, with: .reliable)
                call.resolve()
            } catch {
                call.reject("Could not send: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Internals (main thread)

    private func stopAll() {
        motion.stopDeviceMotionUpdates()
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session?.disconnect()
        nearby.values.forEach { $0.invalidate() }
        nearby.removeAll()
        lastDistanceSent.removeAll()
        advertiser = nil
        browser = nil
        session = nil
        me = nil
    }

    private func packet(_ kind: Kind, _ body: Data) -> Data {
        var data = Data([kind.rawValue])
        data.append(body)
        return data
    }

    private func startMotion() {
        guard motion.isDeviceMotionAvailable else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 60.0
        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let self = self, let a = data?.userAcceleration else { return }
            let g = (a.x * a.x + a.y * a.y + a.z * a.z).squareRoot()
            let now = ProcessInfo.processInfo.systemUptime
            if g >= self.bumpThreshold && now - self.lastBump > 0.5 {
                self.lastBump = now
                self.notifyListeners("bump", data: ["strength": g, "at": Date().timeIntervalSince1970 * 1000])
            }
        }
    }

    /// Starts measuring the distance to a newly linked phone by sending it our token.
    private func beginDistance(to peer: MCPeerID) {
        guard preciseDistance, let session = session else { return }
        let ni = nearby[peer] ?? NISession()
        ni.delegate = self
        nearby[peer] = ni
        guard let token = ni.discoveryToken,
              let body = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) else { return }
        try? session.send(packet(.niToken, body), toPeers: [peer], with: .reliable)
    }

    private func receivedToken(_ body: Data, from peer: MCPeerID) {
        guard preciseDistance,
              let token = try? NSKeyedUnarchiver.unarchivedObject(ofClass: NIDiscoveryToken.self, from: body) else { return }
        if nearby[peer] == nil { beginDistance(to: peer) }
        nearby[peer]?.run(NINearbyPeerConfiguration(peerToken: token))
    }

    private func peer(for session: NISession) -> MCPeerID? {
        nearby.first(where: { $0.value === session })?.key
    }
}

// MARK: - Multipeer

extension GlobeTouchPlugin: MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {
    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            guard session === self.session else { return }
            switch state {
            case .connected:
                self.notifyListeners("peerConnected", data: ["peerId": peerID.displayName])
                self.beginDistance(to: peerID)
            case .notConnected:
                self.nearby.removeValue(forKey: peerID)?.invalidate()
                self.lastDistanceSent.removeValue(forKey: peerID)
                self.notifyListeners("peerLost", data: ["peerId": peerID.displayName])
            default:
                break
            }
        }
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let first = data.first, let kind = Kind(rawValue: first) else { return }
        let body = data.dropFirst()
        DispatchQueue.main.async {
            guard session === self.session else { return }
            switch kind {
            case .message:
                if let text = String(data: body, encoding: .utf8) {
                    self.notifyListeners("message", data: ["peerId": peerID.displayName, "data": text])
                }
            case .niToken:
                self.receivedToken(Data(body), from: peerID)
            }
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        DispatchQueue.main.async {
            invitationHandler(self.session != nil, self.session)
        }
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        DispatchQueue.main.async {
            self.notifyListeners("unavailable", data: ["reason": "network", "message": error.localizedDescription])
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async {
            guard let me = self.me, let session = self.session, browser === self.browser else { return }
            // Only one side invites, or the two invitations cross and both fail.
            guard me.displayName < peerID.displayName, !session.connectedPeers.contains(peerID) else { return }
            browser.invitePeer(peerID, to: session, withContext: nil, timeout: 10)
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        DispatchQueue.main.async {
            self.notifyListeners("unavailable", data: ["reason": "network", "message": error.localizedDescription])
        }
    }
}

// MARK: - Nearby Interaction

extension GlobeTouchPlugin: NISessionDelegate {
    public func session(_ session: NISession, didUpdate nearbyObjects: [NINearbyObject]) {
        DispatchQueue.main.async {
            guard let peer = self.peer(for: session), let object = nearbyObjects.first, let meters = object.distance else { return }
            // About 20 updates a second is plenty for the animation.
            let now = ProcessInfo.processInfo.systemUptime
            if now - (self.lastDistanceSent[peer] ?? 0) < 0.05 { return }
            self.lastDistanceSent[peer] = now
            var data: [String: Any] = ["peerId": peer.displayName, "meters": meters]
            if let d = object.direction {
                data["direction"] = ["x": d.x, "y": d.y, "z": d.z]
            }
            self.notifyListeners("distance", data: data)
        }
    }

    public func session(_ session: NISession, didRemove nearbyObjects: [NINearbyObject], reason: NINearbyObject.RemovalReason) {
        DispatchQueue.main.async {
            guard let peer = self.peer(for: session) else { return }
            // Out of range: try again, the phones may come back together.
            if reason == .timeout, let config = session.configuration {
                session.run(config)
            }
            self.notifyListeners("distance", data: ["peerId": peer.displayName, "meters": -1])
        }
    }

    public func sessionWasSuspended(_ session: NISession) {}

    public func sessionSuspensionEnded(_ session: NISession) {
        if let config = session.configuration { session.run(config) }
    }

    public func session(_ session: NISession, didInvalidateWith error: Error) {
        DispatchQueue.main.async {
            guard let peer = self.peer(for: session) else { return }
            self.nearby.removeValue(forKey: peer)
            if let niError = error as? NIError, niError.code == .userDidNotAllow {
                self.notifyListeners("unavailable", data: ["reason": "distance", "message": "Nearby Interaction was not allowed."])
                return
            }
            // Start over with a fresh token if the phones are still linked.
            if self.session?.connectedPeers.contains(peer) == true {
                self.beginDistance(to: peer)
            }
        }
    }
}
