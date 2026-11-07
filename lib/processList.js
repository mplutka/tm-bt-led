/*
 * Running process names for game detection: tasklist on Windows, /proc on Linux.
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const fs = require("fs");
const path = require("path");
const { isLinux } = require("./platform.js");

function baseName(file) {
    return file.split(/[\\/]/).pop();
}

/**
 * Derives a process name from /proc/<pid>/cmdline (NUL-separated) and /proc/<pid>/comm.
 * Wine/Proton games show up as e.g. "Z:\games\F1 25\F1_25.exe", so Windows paths are split too
 * and a .exe argument wins over its launcher (wine, proton, ...).
 */
function parseProcessName(cmdline, comm = "") {
    const args = String(cmdline || "").split("\0").filter(Boolean);
    const exe = args.find(arg => /\.exe$/i.test(arg));
    if (exe) {
        return baseName(exe);
    }
    if (args.length > 0) {
        return baseName(args[0]);
    }
    return String(comm).trim();
}

function readProcFile(file) {
    try {
        return fs.readFileSync(file, "utf8");
    } catch {
        return "";
    }
}

async function getLinuxProcesses(procDir = "/proc") {
    const entries = await fs.promises.readdir(procDir);
    return entries
        .filter(entry => /^\d+$/.test(entry))
        .map(pid => ({
            name: parseProcessName(readProcFile(path.join(procDir, pid, "cmdline")), readProcFile(path.join(procDir, pid, "comm"))),
            memUsage: 0
        }))
        .filter(task => task.name);
}

async function getProcesses() {
    if (isLinux()) {
        return getLinuxProcesses();
    }
    return require("node-processlist").getProcesses();
}

module.exports = {
    getProcesses,
    getLinuxProcesses,
    parseProcessName
};
