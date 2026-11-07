/*
 * Platform specifics: which game clients run where and how the BLE adapter is accessed.
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

// These clients read Windows named shared memory or use the iRacing SDK.
const WINDOWS_ONLY_CLIENTS = ["assetto", "iracing", "rF2", "raceroom", "ets2"];

const LINUX_ADAPTER_HELP = [
    "On Linux tm-bt-led needs exclusive access to the Bluetooth adapter:",
    "  1. Hand the adapter over:  sudo btmgmt -i hci0 power off   (or: sudo systemctl stop bluetooth)",
    "  2. Allow raw HCI access:   sudo setcap cap_net_raw,cap_net_admin+eip $(readlink -f $(which node))   (or run with sudo)",
    "  3. Remove an old BlueZ pairing of the display, if any:  bluetoothctl remove 00:08:D3:XX:XX:XX",
    "Use \"hciDeviceId\" in the global section of config.json to pick another adapter (default 0 = hci0).",
    "Give the adapter back afterwards with: sudo btmgmt -i hci0 power on"
].join("\n");

function isLinux(platform = process.platform) {
    return platform === "linux";
}

function isClientSupported(clientName, platform = process.platform) {
    return !isLinux(platform) || !WINDOWS_ONLY_CLIENTS.includes(clientName);
}

function filterGamesForPlatform(games, platform = process.platform) {
    return games.filter(game => isClientSupported(game.name, platform));
}

/**
 * On Linux noble must bind the HCI user channel so the kernel's Bluetooth stack (which blocks the
 * display's debug link key and grabs it as a HID gamepad) stays out of the way. No-op elsewhere.
 */
function configureHciEnvironment(env, settings = {}, platform = process.platform) {
    if (!isLinux(platform)) {
        return;
    }
    if (!env.HCI_CHANNEL_USER) {
        env.HCI_CHANNEL_USER = "1";
    }
    if (env.NOBLE_HCI_DEVICE_ID === undefined) {
        const deviceId = Number.parseInt(settings.hciDeviceId, 10);
        env.NOBLE_HCI_DEVICE_ID = String(Number.isInteger(deviceId) && deviceId >= 0 ? deviceId : 0);
    }
}

module.exports = {
    WINDOWS_ONLY_CLIENTS,
    LINUX_ADAPTER_HELP,
    isLinux,
    isClientSupported,
    filterGamesForPlatform,
    configureHciEnvironment
};
