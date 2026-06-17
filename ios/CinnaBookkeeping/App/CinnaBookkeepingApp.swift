import SwiftUI

@main
struct CinnaBookkeepingApp: App {
    @StateObject private var store = BookkeepingStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(CinnaTheme.sky)
        }
    }
}
