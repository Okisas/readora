$projectDir = Split-Path -Parent $PSScriptRoot
$env:XDG_DATA_HOME = Join-Path $projectDir '.libretranslate-data'
$env:XDG_CONFIG_HOME = Join-Path $projectDir '.libretranslate-config'
$env:XDG_CACHE_HOME = Join-Path $projectDir '.libretranslate-cache'

& (Join-Path $projectDir '.venv-libretranslate\Scripts\libretranslate.exe') `
  --host 127.0.0.1 `
  --port 5000 `
  --load-only en,ja,ko,zh,vi
