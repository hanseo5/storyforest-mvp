import { Capacitor } from '@capacitor/core';

let ForegroundService: any = null;
let serviceRunning = false;

/**
 * Dynamically import the foreground service plugin.
 */
async function getPlugin() {
    if (!ForegroundService) {
        const mod = await import('@capawesome-team/capacitor-android-foreground-service');
        ForegroundService = mod.ForegroundService;
    }
    return ForegroundService;
}

/**
 * Start the Android Foreground Service to keep the app alive in background.
 * Must be called BEFORE the heavy work begins.
 */
export async function startForegroundService(body: string = 'Audio generation in progress...'): Promise<void> {
    if (!Capacitor.isNativePlatform() || serviceRunning) return;

    try {
        const plugin = await getPlugin();
        await plugin.startForegroundService({
            id: 1001,
            title: '🌲 StoryForest',
            body,
            smallIcon: 'ic_stat_notify',
            buttons: [],
        });
        serviceRunning = true;
        console.log('[ForegroundService] Started');
    } catch (e) {
        console.warn('[ForegroundService] Start failed:', e);
    }
}

/**
 * Update the foreground service notification body text.
 */
export async function updateForegroundService(body: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !serviceRunning) return;

    try {
        const plugin = await getPlugin();
        await plugin.updateForegroundService({
            id: 1001,
            title: '🌲 StoryForest',
            body,
            smallIcon: 'ic_stat_notify',
        });
    } catch (e) {
        console.warn('[ForegroundService] Update failed:', e);
    }
}

/**
 * Stop the foreground service. Call this when all work is done.
 */
export async function stopForegroundService(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !serviceRunning) return;

    try {
        const plugin = await getPlugin();
        await plugin.stopForegroundService();
        serviceRunning = false;
        console.log('[ForegroundService] Stopped');
    } catch (e) {
        console.warn('[ForegroundService] Stop failed:', e);
    }
}

/**
 * Check if the foreground service is currently running.
 */
export function isForegroundServiceRunning(): boolean {
    return serviceRunning;
}
