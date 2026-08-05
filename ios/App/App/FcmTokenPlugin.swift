import Foundation
import Capacitor
import FirebaseMessaging

// @capacitor/push-notifications hands back the raw APNs device token on
// iOS, which Firebase's Admin SDK (used server-side to send pushes) can't
// target directly — it needs a real FCM registration token. This plugin
// exposes the FCM token Firebase derives once AppDelegate feeds it the
// APNs token (see AppDelegate.swift).
@objc(FcmTokenPlugin)
public class FcmTokenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FcmTokenPlugin"
    public let jsName = "FcmToken"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    @objc func getToken(_ call: CAPPluginCall) {
        Messaging.messaging().token { token, error in
            if let error = error {
                call.reject("Could not fetch FCM token: \(error.localizedDescription)")
                return
            }
            guard let token = token else {
                call.reject("No FCM token available yet.")
                return
            }
            call.resolve(["token": token])
        }
    }
}
