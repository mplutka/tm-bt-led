@echo off
call pnpm install --frozen-lockfile && call pnpm run build && call pnpm run pack
