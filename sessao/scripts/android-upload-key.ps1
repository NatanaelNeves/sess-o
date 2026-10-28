# Gera a upload key do Google Play FORA do repositório, com senha aleatória forte.
#   ~/.sessao-signing/sessao-upload.jks         a chave (faça backup em lugar seguro)
#   ~/.sessao-signing/keystore.properties       caminho, alias e senha lidos pelo Gradle
# A senha nunca é exibida. Se você perder a chave depois de publicar, peça um reset
# da upload key no Play Console (com o Play App Signing a chave final fica com o Google).
$ErrorActionPreference = "Stop"

$dir = Join-Path $HOME ".sessao-signing"
$keystore = Join-Path $dir "sessao-upload.jks"
$props = Join-Path $dir "keystore.properties"
$alias = "sessao-upload"

if (Test-Path $keystore) { throw "Já existe $keystore. Não sobrescrevo uma chave de assinatura." }

$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$keytool = Join-Path $javaHome "bin\keytool.exe"
if (-not (Test-Path $keytool)) { throw "keytool não encontrado em $keytool. Defina JAVA_HOME." }

New-Item -ItemType Directory -Force $dir | Out-Null

$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$env:SESSAO_KS_PASS = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''

try {
    & $keytool -genkeypair -keystore $keystore -storetype PKCS12 -alias $alias `
        -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Sessao, C=BR" `
        -storepass:env SESSAO_KS_PASS -keypass:env SESSAO_KS_PASS
    if ($LASTEXITCODE -ne 0) { throw "keytool falhou ($LASTEXITCODE)." }

    $storePath = $keystore -replace '\\', '/'
    @(
        "storeFile=$storePath",
        "storePassword=$($env:SESSAO_KS_PASS)",
        "keyAlias=$alias",
        "keyPassword=$($env:SESSAO_KS_PASS)"
    ) | Set-Content -Path $props -Encoding ascii

    Write-Host "Upload key criada em $keystore"
    Write-Host "Impressões digitais (públicas) para cadastrar no Firebase:"
    & $keytool -list -v -keystore $keystore -alias $alias -storepass:env SESSAO_KS_PASS |
        Select-String -Pattern "SHA1:|SHA256:"
} finally {
    Remove-Item Env:SESSAO_KS_PASS -ErrorAction SilentlyContinue
}
