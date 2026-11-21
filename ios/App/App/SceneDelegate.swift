import UIKit
import Capacitor

/// The app's window, the way iOS 27 requires of apps built with its SDK (the
/// UIScene life cycle: without it they stop at launch). The window and its
/// view controller come from Main.storyboard (UISceneStoryboardFile in
/// Info.plist); links that open the app reach Capacitor as before, through
/// ApplicationDelegateProxy, so deep links, sign-in returns and the App
/// plugin's launch URL keep working.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Opened by a link or a Universal Link while not running.
        if let url = connectionOptions.urlContexts.first?.url {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    // A link while running (our own URL scheme: sign-in returns, deep links).
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    // A Universal Link (expandiax.com) while running.
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
