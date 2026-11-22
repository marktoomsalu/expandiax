import Foundation
import Security

/// The share key, in a keychain group the app and its share sheet both
/// belong to (keychain-access-groups in both entitlements). The app puts it
/// there once it's signed in; the share sheet reads it to add photos as
/// that person. Never leaves the phone except to ExpandiaX itself.
enum ShareKeychain {
    struct Key: Codable {
        let token: String
        let userId: String
    }

    /// "<team>.com.expandiax.shared", from Info.plist (ShareKeychainGroup = $(AppIdentifierPrefix)com.expandiax.shared).
    private static var group: String? {
        Bundle.main.object(forInfoDictionaryKey: "ShareKeychainGroup") as? String
    }

    private static func query() -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.expandiax.share",
            kSecAttrAccount as String: "share-key",
        ]
        if let group, !group.hasPrefix("$(") { q[kSecAttrAccessGroup as String] = group }
        return q
    }

    @discardableResult
    static func save(_ key: Key) -> Bool {
        guard let data = try? JSONEncoder().encode(key) else { return false }
        SecItemDelete(query() as CFDictionary)
        var add = query()
        add[kSecValueData as String] = data
        // Readable whenever the phone has been unlocked once since it started: a share is always after that.
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    static func read() -> Key? {
        var q = query()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(Key.self, from: data)
    }

    static func clear() {
        SecItemDelete(query() as CFDictionary)
    }
}
