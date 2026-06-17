import SwiftUI

enum CinnaTheme {
    static let background = Color(red: 0.96, green: 0.985, blue: 1.0)
    static let card = Color.white
    static let sky = Color(red: 0.31, green: 0.66, blue: 0.83)
    static let skySoft = Color(red: 0.84, green: 0.94, blue: 0.98)
    static let pink = Color(red: 1.0, green: 0.53, blue: 0.67)
    static let pinkSoft = Color(red: 1.0, green: 0.9, blue: 0.94)
    static let mint = Color(red: 0.24, green: 0.76, blue: 0.62)
    static let yellow = Color(red: 1.0, green: 0.79, blue: 0.36)
    static let ink = Color(red: 0.16, green: 0.28, blue: 0.36)
    static let muted = Color(red: 0.47, green: 0.57, blue: 0.64)
    static let line = Color(red: 0.87, green: 0.93, blue: 0.96)
    static let radius: CGFloat = 8
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(CinnaTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: CinnaTheme.radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: CinnaTheme.radius, style: .continuous)
                    .stroke(CinnaTheme.line, lineWidth: 1)
            )
    }
}

extension View {
    func cinnaCard() -> some View {
        modifier(CardStyle())
    }

    @ViewBuilder
    func decimalInput() -> some View {
        #if os(iOS)
        keyboardType(.decimalPad)
        #else
        self
        #endif
    }
}
