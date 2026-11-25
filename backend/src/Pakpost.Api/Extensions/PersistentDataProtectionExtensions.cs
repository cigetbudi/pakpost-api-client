using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;

namespace Pakpost.Api.Extensions;

public static class PersistentDataProtectionExtensions
{
    public static IServiceCollection AddPakpostPersistentDataProtection(
        this IServiceCollection services, IConfiguration configuration)
    {
        var directory = configuration["DataProtection:KeyDirectory"];
        var certificatePath = configuration["DataProtection:CertificatePath"];
        var privateKeyPath = configuration["DataProtection:PrivateKeyPath"];
        if (string.IsNullOrWhiteSpace(directory) && string.IsNullOrWhiteSpace(certificatePath) &&
            string.IsNullOrWhiteSpace(privateKeyPath)) return services;

        if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(certificatePath) ||
            string.IsNullOrWhiteSpace(privateKeyPath) || !Directory.Exists(directory))
            throw new InvalidOperationException("Persistent Data Protection requires an existing key directory and certificate/key files.");

        // Detect a read-only or incorrectly owned mount before reporting ready.
        using (File.Create(Path.Combine(directory, $".write-probe-{Guid.NewGuid():N}"),
                   1, FileOptions.DeleteOnClose)) { }

        // Fail closed on missing/unreadable certificate. The host provisions this separately
        // from application secrets and workspace envelope encryption keys.
        var certificate = X509Certificate2.CreateFromPemFile(certificatePath, privateKeyPath);
        if (!certificate.HasPrivateKey || certificate.GetRSAPrivateKey() is not { } rsa)
        {
            certificate.Dispose();
            throw new InvalidOperationException("Data Protection certificate requires an RSA private key.");
        }
        rsa.Dispose();
        services.AddDataProtection()
            .SetApplicationName("Pakpost.Api")
            .PersistKeysToFileSystem(new DirectoryInfo(directory))
            .ProtectKeysWithCertificate(certificate);
        return services;
    }
}
