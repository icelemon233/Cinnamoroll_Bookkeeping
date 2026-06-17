package com.icelemon233.cinnabookkeeping.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object CinnaPalette {
    val Background = Color(0xFFF5FBFF)
    val Card = Color.White
    val Sky = Color(0xFF4FA8D3)
    val SkySoft = Color(0xFFD7EFF9)
    val Pink = Color(0xFFFF87AA)
    val PinkSoft = Color(0xFFFFE6EF)
    val Mint = Color(0xFF41C59F)
    val Yellow = Color(0xFFFFC95C)
    val Ink = Color(0xFF294859)
    val Muted = Color(0xFF788B98)
    val Line = Color(0xFFDDECF2)
}

private val LightColors = lightColorScheme(
    primary = CinnaPalette.Sky,
    secondary = CinnaPalette.Pink,
    tertiary = CinnaPalette.Mint,
    background = CinnaPalette.Background,
    surface = CinnaPalette.Card,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = CinnaPalette.Ink,
    onSurface = CinnaPalette.Ink
)

@Composable
fun CinnaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = Typography(),
        content = content
    )
}
