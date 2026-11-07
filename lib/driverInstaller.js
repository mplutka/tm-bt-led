/*
 * Puts the Bluetooth stick on the WinUSB driver (and back).
 * Uses the Microsoft-signed inbox winusb.inf, i.e. the same as Device Manager's
 * "Let me pick > Universal Serial Bus devices > WinUsb Device": no driver package, no certificate.
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline/promises");
const { spawnSync } = require("child_process");
const { getGlobalSettings } = require("./configLoader.js");

// Keep in sync with VENDOR_DEVICE_LIST in patches/@abandonware__bluetooth-hci-socket.patch
const SUPPORTED_STICKS = [
    [0x0cf3, 0xe300], [0x0a5c, 0x21e8], [0x0a5c, 0x21f1], [0x19ff, 0x0239], [0x413c, 0x8143],
    [0x0a12, 0x0001], [0x0b05, 0x17cb], [0x8087, 0x07da], [0x8087, 0x07dc], [0x8087, 0x0a2a],
    [0x8087, 0x0a2b], [0x0489, 0xe07a], [0x0a5c, 0x6412], [0x050d, 0x065a], [0x1286, 0x204c],
    [0x8087, 0x0025], [0x0bda, 0x8771], [0x2357, 0x0604]
];

const LIST_SCRIPT = `
$ids = ConvertFrom-Json '__IDS__'
$found = foreach ($d in Get-PnpDevice -PresentOnly) {
    if ($d.InstanceId -notmatch '^USB\\\\(VID_[0-9A-F]{4}&PID_[0-9A-F]{4})(&MI_(\\d{2}))?\\\\') { continue }
    if ($ids -notcontains $Matches[1]) { continue }
    $iface = $Matches[3]
    $service = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName DEVPKEY_Device_Service -ErrorAction SilentlyContinue).Data
    [pscustomobject]@{ instanceId = $d.InstanceId; name = $d.FriendlyName; class = $d.Class; status = [string]$d.Status; service = $service; iface = $iface }
}
ConvertTo-Json -Compress -InputObject @($found)
`;

const ELEVATED_SCRIPT = `
param([string]$RequestPath, [string]$LogPath)
$ErrorActionPreference = 'Stop'
function Log($m) { Add-Content -Encoding utf8 -Path $LogPath -Value $m }
try {
    $req = Get-Content -Raw $RequestPath | ConvertFrom-Json
    if ($req.mode -eq 'install') {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class WinUsbForcer {
    const uint DI_ENUMSINGLEINF = 0x00010000;
    const uint DI_FLAGSEX_ALLOWEXCLUDEDDRVS = 0x00000800;
    const uint SPDIT_CLASSDRIVER = 1;
    const uint SPDRP_CLASSGUID = 0x8;
    static readonly Guid UsbDeviceClass = new Guid("88BAE032-5A81-49f0-BC3D-A4FF138216D6");

    [StructLayout(LayoutKind.Sequential)]
    struct SP_DEVINFO_DATA { public int cbSize; public Guid ClassGuid; public int DevInst; public IntPtr Reserved; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SP_DEVINSTALL_PARAMS {
        public int cbSize; public uint Flags; public uint FlagsEx; public IntPtr hwndParent;
        public IntPtr InstallMsgHandler; public IntPtr InstallMsgHandlerContext; public IntPtr FileQueue;
        public IntPtr ClassInstallReserved; public int Reserved;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DriverPath;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SP_DRVINFO_DATA {
        public int cbSize; public uint DriverType; public UIntPtr Reserved;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string Description;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string MfgName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string ProviderName;
        public long DriverDate; public ulong DriverVersion;
    }

    [DllImport("setupapi.dll", SetLastError = true)] static extern IntPtr SetupDiCreateDeviceInfoList(IntPtr classGuid, IntPtr hwnd);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiOpenDeviceInfo(IntPtr set, string instanceId, IntPtr hwnd, uint flags, ref SP_DEVINFO_DATA data);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiSetDeviceRegistryProperty(IntPtr set, ref SP_DEVINFO_DATA data, uint prop, byte[] buf, int size);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiGetDeviceInstallParams(IntPtr set, ref SP_DEVINFO_DATA data, ref SP_DEVINSTALL_PARAMS p);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiSetDeviceInstallParams(IntPtr set, ref SP_DEVINFO_DATA data, ref SP_DEVINSTALL_PARAMS p);
    [DllImport("setupapi.dll", SetLastError = true)] static extern bool SetupDiBuildDriverInfoList(IntPtr set, ref SP_DEVINFO_DATA data, uint type);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiEnumDriverInfo(IntPtr set, ref SP_DEVINFO_DATA data, uint type, int index, ref SP_DRVINFO_DATA drv);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiGetDriverInfoDetail(IntPtr set, ref SP_DEVINFO_DATA data, ref SP_DRVINFO_DATA drv, IntPtr detail, int size, out int required);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiSetSelectedDriver(IntPtr set, ref SP_DEVINFO_DATA data, ref SP_DRVINFO_DATA drv);
    [DllImport("setupapi.dll", SetLastError = true)] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("newdev.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool DiInstallDevice(IntPtr hwnd, IntPtr set, ref SP_DEVINFO_DATA data, ref SP_DRVINFO_DATA drv, uint flags, out bool reboot);

    static Exception Fail(string what) {
        int e = Marshal.GetLastWin32Error();
        return new Exception(what + " failed: 0x" + e.ToString("X8") + " " + new Win32Exception(e).Message);
    }

    // Driver descriptions are localized ("WinUsb-Geraet"), the INF section name is not.
    static string SectionName(IntPtr set, ref SP_DEVINFO_DATA dev, ref SP_DRVINFO_DATA drv) {
        bool is64 = IntPtr.Size == 8;
        int size = 8192;
        IntPtr buf = Marshal.AllocHGlobal(size);
        try {
            Marshal.WriteInt32(buf, is64 ? 1584 : 1572);
            int required;
            if (!SetupDiGetDriverInfoDetail(set, ref dev, ref drv, buf, size, out required)) return null;
            return Marshal.PtrToStringUni(IntPtr.Add(buf, is64 ? 32 : 24));
        } finally {
            Marshal.FreeHGlobal(buf);
        }
    }

    public static string Install(string instanceId, string infPath) {
        IntPtr set = SetupDiCreateDeviceInfoList(IntPtr.Zero, IntPtr.Zero);
        if (set == new IntPtr(-1)) throw Fail("SetupDiCreateDeviceInfoList");
        try {
            var dev = new SP_DEVINFO_DATA(); dev.cbSize = Marshal.SizeOf(dev);
            if (!SetupDiOpenDeviceInfo(set, instanceId, IntPtr.Zero, 0, ref dev)) throw Fail("SetupDiOpenDeviceInfo");

            // Class driver lists only contain drivers of the device's class, winusb.inf is USBDevice.
            if (dev.ClassGuid != UsbDeviceClass) {
                byte[] guid = System.Text.Encoding.Unicode.GetBytes(UsbDeviceClass.ToString("B") + "\\0");
                if (!SetupDiSetDeviceRegistryProperty(set, ref dev, SPDRP_CLASSGUID, guid, guid.Length)) throw Fail("Changing device class");
            }

            var p = new SP_DEVINSTALL_PARAMS(); p.cbSize = Marshal.SizeOf(p);
            if (!SetupDiGetDeviceInstallParams(set, ref dev, ref p)) throw Fail("SetupDiGetDeviceInstallParams");
            p.Flags |= DI_ENUMSINGLEINF; p.FlagsEx |= DI_FLAGSEX_ALLOWEXCLUDEDDRVS; p.DriverPath = infPath;
            if (!SetupDiSetDeviceInstallParams(set, ref dev, ref p)) throw Fail("SetupDiSetDeviceInstallParams");
            if (!SetupDiBuildDriverInfoList(set, ref dev, SPDIT_CLASSDRIVER)) throw Fail("SetupDiBuildDriverInfoList");

            var drv = new SP_DRVINFO_DATA(); drv.cbSize = Marshal.SizeOf(drv);
            for (int i = 0; SetupDiEnumDriverInfo(set, ref dev, SPDIT_CLASSDRIVER, i, ref drv); i++) {
                if (SectionName(set, ref dev, ref drv) != "WINUSB") continue;
                if (!SetupDiSetSelectedDriver(set, ref dev, ref drv)) throw Fail("SetupDiSetSelectedDriver");
                bool reboot;
                if (!DiInstallDevice(IntPtr.Zero, set, ref dev, ref drv, 0, out reboot)) throw Fail("DiInstallDevice");
                return reboot ? "INSTALLED_REBOOT" : "INSTALLED";
            }
            throw new Exception("WinUSB driver not found in " + infPath);
        } finally {
            SetupDiDestroyDeviceInfoList(set);
        }
    }
}
'@
        Log ([WinUsbForcer]::Install($req.instanceId, "$env:WINDIR\\INF\\winusb.inf"))
    } elseif ($req.mode -eq 'restore') {
        $out = & pnputil /remove-device $req.instanceId 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "pnputil /remove-device failed: $out" }
        & pnputil /scan-devices | Out-Null
        Log 'RESTORED'
    }
    exit 0
} catch {
    Log ("ERROR: " + $_.Exception.Message)
    exit 1
}
`;

function toVidPidId(vid, pid) {
    const hex = n => n.toString(16).toUpperCase().padStart(4, "0");
    return `VID_${hex(vid)}&PID_${hex(pid)}`;
}

function supportedVidPidIds(additional = []) {
    const extra = additional.map(e => [Number.parseInt(String(e.vid), 0), Number.parseInt(String(e.pid), 0)])
        .filter(([vid, pid]) => Number.isInteger(vid) && Number.isInteger(pid));
    return [...SUPPORTED_STICKS, ...extra].map(([vid, pid]) => toVidPidId(vid, pid));
}

function runPowerShell(script) {
    const result = spawnSync("powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
        { encoding: "utf8", windowsHide: true });
    if (result.error) {
        throw result.error;
    }
    return result;
}

/**
 * The HCI interface of composite radios is interface 0 (&MI_00); the composite parent itself
 * (usbccgp) must keep its driver.
 */
function isHciCandidate(device) {
    if (device.iface) {
        return device.iface === "00";
    }
    return String(device.service || "").toLowerCase() !== "usbccgp";
}

function isWinUsb(device) {
    return String(device.service || "").toLowerCase() === "winusb";
}

function listSticks(additional = getGlobalSettings().additionalUsbVidPids || []) {
    const ids = JSON.stringify(supportedVidPidIds(additional)).replace(/'/g, "''");
    const result = runPowerShell(LIST_SCRIPT.replace("__IDS__", ids));
    if (result.status !== 0) {
        throw new Error(`Device enumeration failed: ${result.stderr || result.stdout}`);
    }
    const parsed = JSON.parse(result.stdout.trim() || "[]");
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(isHciCandidate);
}

function runElevated(request) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-bt-led-"));
    const scriptPath = path.join(dir, "driver.ps1");
    const requestPath = path.join(dir, "request.json");
    const logPath = path.join(dir, "result.log");
    try {
        fs.writeFileSync(scriptPath, "\ufeff" + ELEVATED_SCRIPT, "utf8");
        fs.writeFileSync(requestPath, JSON.stringify(request), "utf8");
        const q = s => s.replace(/'/g, "''");
        const args = `-NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -RequestPath "${requestPath}" -LogPath "${logPath}"`;
        const launcher = `try { $p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '${q(args)}'; exit $p.ExitCode } catch { Write-Output $_.Exception.Message; exit 2 }`;
        const result = runPowerShell(launcher);
        const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").replace(/^\ufeff/, "").trim() : "";
        if (result.status === 2) {
            return { ok: false, message: `Administrator permission was not granted (${result.stdout.trim()})` };
        }
        return { ok: result.status === 0, message: log || result.stdout.trim() || result.stderr.trim() };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function describe(device) {
    return `${device.name} [${device.instanceId}] driver: ${device.service || "none"} (${device.status})`;
}

async function choose(devices, verb) {
    if (devices.length === 1) {
        return devices[0];
    }
    devices.forEach((d, i) => console.log(`  ${i + 1}) ${describe(d)}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = (await rl.question(`Which device should be ${verb}? [1-${devices.length}, empty = cancel] `)).trim();
        return devices[Number.parseInt(answer, 10) - 1] || null;
    } finally {
        rl.close();
    }
}

async function confirm(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return /^y(es)?$|^j(a)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
    } finally {
        rl.close();
    }
}

async function installDriver() {
    const sticks = listSticks();
    if (sticks.length === 0) {
        console.log("No supported Bluetooth stick found. Plug it in, or add its VID/PID to additionalUsbVidPids in config.json.");
        return 1;
    }
    sticks.filter(isWinUsb).forEach(d => console.log(`Already on WinUSB: ${describe(d)}`));
    const candidates = sticks.filter(d => !isWinUsb(d));
    if (candidates.length === 0) {
        console.log("Nothing to do - start tm-bt-led.exe.");
        return 0;
    }

    console.log("Supported Bluetooth adapters found:");
    candidates.forEach(d => console.log(`  ${describe(d)}`));
    const device = await choose(candidates, "switched to WinUSB");
    if (!device) {
        console.log("Cancelled.");
        return 1;
    }
    console.log(`\n${device.name} will be switched to the Microsoft WinUSB driver.`);
    console.log("Windows can no longer use this adapter for other Bluetooth devices until you run --restoreDriver.");
    console.log("Do NOT do this for the built-in Bluetooth of a laptop/mainboard you still need.");
    if (!await confirm("Continue?")) {
        console.log("Cancelled.");
        return 1;
    }

    console.log("Installing (confirm the Windows administrator prompt)...");
    const result = runElevated({ mode: "install", instanceId: device.instanceId });
    if (!result.ok) {
        console.error(`Driver installation failed: ${result.message}`);
        return 1;
    }
    if (result.message === "INSTALLED_REBOOT") {
        console.log("WinUSB installed. Please reboot Windows before starting tm-bt-led.exe.");
    } else {
        console.log("WinUSB installed. Unplug and replug the stick if tm-bt-led.exe does not find it.");
    }
    return 0;
}

async function restoreDriver() {
    const candidates = listSticks().filter(isWinUsb);
    if (candidates.length === 0) {
        console.log("No supported Bluetooth stick is using WinUSB - nothing to restore.");
        return 0;
    }
    const device = await choose(candidates, "restored to the Windows Bluetooth driver");
    if (!device) {
        console.log("Cancelled.");
        return 1;
    }
    console.log("Restoring the Windows Bluetooth driver (confirm the Windows administrator prompt)...");
    const result = runElevated({ mode: "restore", instanceId: device.instanceId });
    if (!result.ok) {
        console.error(`Restoring failed: ${result.message}`);
        return 1;
    }
    console.log("Windows Bluetooth driver restored. Unplug and replug the stick if it does not show up.");
    return 0;
}

module.exports = {
    installDriver,
    restoreDriver,
    listSticks,
    supportedVidPidIds,
    isHciCandidate
};
