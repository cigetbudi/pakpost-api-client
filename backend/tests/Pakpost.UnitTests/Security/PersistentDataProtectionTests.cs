using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pakpost.Api.Extensions;

namespace Pakpost.UnitTests;

public sealed class PersistentDataProtectionTests
{
    [Fact]
    public void PartialConfigurationFailsInsteadOfFallingBackToEphemeralKeys()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["DataProtection:KeyDirectory"] = Path.GetTempPath() }).Build();
        Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddPakpostPersistentDataProtection(config));
    }

    [Fact]
    public void EncryptedKeyRingSurvivesIndependentServiceProviders()
    {
        var directory = Directory.CreateTempSubdirectory("pakpost-dp-test-");
        try
        {
            var keys = directory.CreateSubdirectory("keys");
            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest("CN=Pakpost test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(1));
            var certFile = Path.Combine(directory.FullName, "cert.pem");
            var keyFile = Path.Combine(directory.FullName, "key.pem");
            File.WriteAllText(certFile, certificate.ExportCertificatePem());
            File.WriteAllText(keyFile, rsa.ExportPkcs8PrivateKeyPem());
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DataProtection:KeyDirectory"] = keys.FullName,
                ["DataProtection:CertificatePath"] = certFile,
                ["DataProtection:PrivateKeyPath"] = keyFile
            }).Build();
            ServiceProvider NewProvider()
            {
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddPakpostPersistentDataProtection(configuration);
                return services.BuildServiceProvider();
            }
            string payload;
            using (var first = NewProvider())
                payload = first.GetRequiredService<IDataProtectionProvider>().CreateProtector("test").Protect("fixture");
            var keyFileXml = Assert.Single(Directory.GetFiles(keys.FullName, "key-*.xml"));
            Assert.Contains("encryptedSecret", File.ReadAllText(keyFileXml));
            using var second = NewProvider();
            Assert.Equal("fixture", second.GetRequiredService<IDataProtectionProvider>().CreateProtector("test").Unprotect(payload));
        }
        finally { directory.Delete(true); }
    }
}
