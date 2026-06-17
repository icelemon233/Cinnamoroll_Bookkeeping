import SwiftUI

enum AppTab: Hashable {
    case home
    case editor
    case records
    case stats
    case profile
}

struct RootView: View {
    @State private var selectedTab: AppTab = .home
    @State private var editorKind: RecordKind = .expense
    @State private var editingRecord: BookkeepingRecord?

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(
                onAdd: { kind in
                    editorKind = kind
                    selectedTab = .editor
                },
                onShowRecords: { selectedTab = .records }
            )
            .tabItem { Label("首页", systemImage: "house.fill") }
            .tag(AppTab.home)

            RecordEditorView(existing: nil, initialKind: editorKind) {
                selectedTab = .home
            }
            .id("new-\(editorKind.rawValue)")
            .tabItem { Label("记一笔", systemImage: "plus.circle.fill") }
            .tag(AppTab.editor)

            RecordsView(onEdit: { editingRecord = $0 })
                .tabItem { Label("账单", systemImage: "list.bullet.rectangle") }
                .tag(AppTab.records)

            StatsView()
                .tabItem { Label("统计", systemImage: "chart.pie.fill") }
                .tag(AppTab.stats)

            ProfileView()
                .tabItem { Label("设置", systemImage: "gearshape.fill") }
                .tag(AppTab.profile)
        }
        .sheet(item: $editingRecord) { record in
            NavigationStack {
                RecordEditorView(existing: record, initialKind: record.kind)
            }
        }
    }
}
