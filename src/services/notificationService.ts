import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Notification IDs (fixed so we can update them in-place)
const PROGRESS_NOTIFICATION_ID = 9001;
const DONE_NOTIFICATION_ID = 9002;

let permissionGranted = false;

/**
 * Request notification permission (Android 13+ requires runtime permission).
 * Call this once early, e.g. after voice clone starts.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    try {
        const { display } = await LocalNotifications.checkPermissions();
        if (display === 'granted') {
            permissionGranted = true;
            return true;
        }

        const result = await LocalNotifications.requestPermissions();
        permissionGranted = result.display === 'granted';
        return permissionGranted;
    } catch (e) {
        console.warn('[Notification] Permission request failed:', e);
        return false;
    }
}

/**
 * Show or update a progress notification in the status bar.
 */
export async function showProgressNotification(opts: {
    phase: string;
    title?: string;
    body: string;
}): Promise<void> {
    if (!Capacitor.isNativePlatform() || !permissionGranted) return;

    try {
        // Cancel previous progress notification before scheduling new one
        await LocalNotifications.cancel({ notifications: [{ id: PROGRESS_NOTIFICATION_ID }] }).catch(() => {});

        await LocalNotifications.schedule({
            notifications: [
                {
                    id: PROGRESS_NOTIFICATION_ID,
                    title: opts.title || '🌲 StoryForest',
                    body: opts.body,
                    ongoing: true,        // Cannot be swiped away
                    autoCancel: false,
                    smallIcon: 'ic_stat_notify',
                    largeIcon: 'ic_launcher',
                },
            ],
        });
    } catch (e) {
        console.warn('[Notification] Show progress failed:', e);
    }
}

/**
 * Show a completion notification.
 */
export async function showDoneNotification(body: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !permissionGranted) return;

    try {
        // Remove progress notification
        await clearProgressNotification();

        await LocalNotifications.schedule({
            notifications: [
                {
                    id: DONE_NOTIFICATION_ID,
                    title: '🌲 StoryForest',
                    body,
                    autoCancel: true,
                    smallIcon: 'ic_stat_notify',
                    largeIcon: 'ic_launcher',
                },
            ],
        });
    } catch (e) {
        console.warn('[Notification] Show done failed:', e);
    }
}

/**
 * Clear the ongoing progress notification.
 */
export async function clearProgressNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await LocalNotifications.cancel({
            notifications: [{ id: PROGRESS_NOTIFICATION_ID }],
        });
    } catch (e) {
        // ignore
    }
}
