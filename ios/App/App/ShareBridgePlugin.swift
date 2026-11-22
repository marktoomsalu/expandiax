import Foundation
import Capacitor

/// Share to ExpandiaX (build 19 on): the website, signed in, hands the app a
/// share key for the Share button's sheet (see ShareKeychain), and takes it
/// back on sign-out. The sheet itself is the ShareExtension target.
@objc(ShareBridgePlugin)
public class ShareBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareBridgePlugin"
    public let jsName = "ShareBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearKey", returnType: CAPPluginReturnPromise),
    ]

    /// Which account the sheet would add to (nil: none set up yet).
    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["userId": ShareKeychain.read()?.userId ?? NSNull()])
    }

    @objc func setKey(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let userId = call.getString("userId") else {
            call.reject("token and userId are needed")
            return
        }
        call.resolve(["saved": ShareKeychain.save(.init(token: token, userId: userId))])
    }

    /// Returns the key it had, so the website can switch it off on the server too.
    @objc func clearKey(_ call: CAPPluginCall) {
        let had = ShareKeychain.read()?.token
        ShareKeychain.clear()
        call.resolve(["token": had ?? NSNull()])
    }
}
