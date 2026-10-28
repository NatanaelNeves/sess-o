import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // App aberto a frio por um atalho do ícone: espera os plugins carregarem
        if let shortcut = connectionOptions.shortcutItem {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { [weak self] _ in
                if let token { NotificationCenter.default.removeObserver(token) }
                self?.openShortcut(shortcut)
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // Atalho do ícone com o app já aberto
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(openShortcut(shortcutItem))
    }

    // "com.natanaelneves.sessao.registrar" vira com.natanaelneves.sessao://acao/registrar,
    // o mesmo link dos atalhos do Android (src/appActions.js decide a tela).
    // Passa pelo ApplicationDelegateProxy: o plugin App recebe em appUrlOpen e getLaunchUrl.
    @discardableResult
    private func openShortcut(_ item: UIApplicationShortcutItem) -> Bool {
        guard let action = item.type.split(separator: ".").last,
              let url = URL(string: "com.natanaelneves.sessao://acao/\(action)") else { return false }
        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }
}
