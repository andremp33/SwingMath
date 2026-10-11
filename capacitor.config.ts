import type { CapacitorConfig } from '@capacitor/cli'

// The store apps wrap the same web build (dist/), served from the device.
const config: CapacitorConfig = {
  appId: 'app.swingmath',
  appName: 'SwingMath',
  webDir: 'dist',
  android: { backgroundColor: '#141312' },
  ios: { backgroundColor: '#141312', contentInset: 'never' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#141312', showSpinner: false },
    LocalNotifications: { smallIcon: 'ic_stat_swingmath', iconColor: '#d9764a' },
  },
}

export default config
