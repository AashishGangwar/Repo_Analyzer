# Create certs directory if it doesn't exist
$certsDir = ".\certs"
if (!(Test-Path -Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir
}

# Generate a self-signed certificate
$cert = New-SelfSignedCertificate \
    -DnsName "localhost" \
    -CertStoreLocation "cert:\LocalMachine\My" \
    -FriendlyName "Localhost Development Certificate" \
    -NotAfter (Get-Date).AddYears(10) \
    -KeySpec Signature

# Export the certificate
$certPath = "cert:\LocalMachine\My\$($cert.Thumbprint)"
$pfxPath = "$certsDir\localhost.pfx"
$pemPath = "$certsDir\localhost.pem"
$keyPath = "$certsDir\localhost-key.pem"

# Export PFX
Export-PfxCertificate -Cert $certPath -FilePath $pfxPath -Password (ConvertTo-SecureString -String "" -Force -AsPlainText)

# Export PEM and KEY
$pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
$pfx.Import($pfxPath, "", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)

# Export certificate
$pem = "-----BEGIN CERTIFICATE-----`n"
$pem += [Convert]::ToBase64String($pfx.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), 'InsertLineBreaks')
$pem += "`n-----END CERTIFICATE-----"
[System.IO.File]::WriteAllText($pemPath, $pem)

# Export private key
$privateKey = [System.Convert]::ToBase64String($pfx.PrivateKey.ExportPkcs8PrivateKey())
$privateKeyPem = "-----BEGIN PRIVATE KEY-----`n"
$privateKeyPem += $privateKey -replace ".{64}(?=.)", "`$0`n"
$privateKeyPem += "`n-----END PRIVATE KEY-----"
[System.IO.File]::WriteAllText($keyPath, $privateKeyPem)

Write-Host "Certificates generated successfully in the 'certs' directory!"
