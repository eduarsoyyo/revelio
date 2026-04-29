# Setup ESLint + Prettier para Revelio v2
# Ejecutar desde C:\Users\eduardo.ybarra\Desktop\revelio\revelio-v2

Write-Host "Instalando dependencias de ESLint + Prettier..." -ForegroundColor Cyan

# Instalar todas las dependencias necesarias
npm install --save-dev `
  eslint@^8.57.0 `
  prettier@^3.2.5 `
  @typescript-eslint/parser@^7.6.0 `
  @typescript-eslint/eslint-plugin@^7.6.0 `
  eslint-plugin-react@^7.34.1 `
  eslint-plugin-react-hooks@^4.6.0 `
  eslint-plugin-import@^2.29.1 `
  eslint-import-resolver-typescript@^3.6.1 `
  eslint-config-prettier@^9.1.0

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error instalando dependencias" -ForegroundColor Red
    exit 1
}

Write-Host "Dependencias instaladas correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "Verificando configuracion..." -ForegroundColor Cyan

# Verificar que los ficheros de config existen
$configs = @(".eslintrc.json", ".eslintignore", ".prettierrc.json", ".prettierignore")
foreach ($config in $configs) {
    if (Test-Path $config) {
        Write-Host "  OK $config" -ForegroundColor Green
    } else {
        Write-Host "  FALTA $config" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Anadiendo scripts a package.json..." -ForegroundColor Cyan

# Leer package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

# Anadir scripts si no existen
if (-not $packageJson.scripts.lint) {
    $packageJson.scripts | Add-Member -NotePropertyName "lint" -NotePropertyValue "eslint . --ext ts,tsx --max-warnings 0" -Force
}
if (-not $packageJson.scripts."lint:fix") {
    $packageJson.scripts | Add-Member -NotePropertyName "lint:fix" -NotePropertyValue "eslint . --ext ts,tsx --fix" -Force
}
if (-not $packageJson.scripts.format) {
    $packageJson.scripts | Add-Member -NotePropertyName "format" -NotePropertyValue "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"" -Force
}
if (-not $packageJson.scripts."format:check") {
    $packageJson.scripts | Add-Member -NotePropertyName "format:check" -NotePropertyValue "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"" -Force
}

# Guardar package.json
$packageJson | ConvertTo-Json -Depth 10 | Out-File "package.json" -Encoding utf8

Write-Host "Scripts anadidos: lint, lint:fix, format, format:check" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecutando primer chequeo (esto puede tardar)..." -ForegroundColor Cyan
Write-Host "Esto solo muestra warnings, no falla. La integracion real es despues." -ForegroundColor Yellow
Write-Host ""

npm run lint 2>&1 | Select-Object -Last 30

Write-Host ""
Write-Host "Setup completado." -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMOS PASOS:" -ForegroundColor Cyan
Write-Host "  1. npm run lint        - Ver warnings/errores"
Write-Host "  2. npm run lint:fix    - Auto-arreglar lo que se pueda"
Write-Host "  3. npm run format      - Aplicar Prettier a todo"
Write-Host "  4. npm run build       - Verificar que sigue compilando"
