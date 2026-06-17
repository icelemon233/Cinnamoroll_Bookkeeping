package com.icelemon233.cinnabookkeeping

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.icelemon233.cinnabookkeeping.ui.CinnaBookkeepingApp
import com.icelemon233.cinnabookkeeping.ui.theme.CinnaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CinnaTheme {
                CinnaBookkeepingApp()
            }
        }
    }
}
