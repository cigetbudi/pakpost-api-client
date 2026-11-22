using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Pakpost.Infrastructure.Services;

namespace Pakpost.UnitTests;

public sealed class WorkspaceCryptographyTests
{
    [Fact]
    public void WorkspaceKeysAndFieldsRoundTripWithoutExposingPlaintext()
    {
        var crypto = CreateCryptography();
        var workspaceId = Guid.NewGuid();
        var recordId = Guid.NewGuid();
        var dek = RandomNumberGenerator.GetBytes(32);
        var wrapped = crypto.Wrap(workspaceId, dek);
        var encrypted = crypto.Protect(dek, workspaceId, "request", recordId,
            "Body", "private request body");

        Assert.StartsWith(WorkspaceCryptography.ContentPrefix, wrapped);
        Assert.StartsWith(WorkspaceCryptography.ContentPrefix, encrypted);
        Assert.DoesNotContain("private request body", encrypted);
        Assert.Equal(dek, crypto.Unwrap(workspaceId, wrapped));
        Assert.Equal("private request body", crypto.Unprotect(dek, workspaceId,
            "request", recordId, "Body", encrypted));
    }

    [Fact]
    public void ChangingWorkspaceRecordOrFieldRejectsCiphertext()
    {
        var crypto = CreateCryptography();
        var workspaceId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        var dek = RandomNumberGenerator.GetBytes(32);
        var encrypted = crypto.Protect(dek, workspaceId, "request", requestId, "Url",
            "https://internal.example.test");

        Assert.ThrowsAny<CryptographicException>(() =>
            crypto.Unprotect(dek, Guid.NewGuid(), "request", requestId, "Url", encrypted));

        Assert.ThrowsAny<CryptographicException>(() =>
            crypto.Unprotect(dek, workspaceId, "request", Guid.NewGuid(), "Url", encrypted));

        Assert.ThrowsAny<CryptographicException>(() =>
            crypto.Unprotect(dek, workspaceId, "request", requestId, "Body", encrypted));
    }

    [Fact]
    public void WorkspaceKeyCannotBeUnwrappedWithAnotherWorkspaceId()
    {
        var crypto = CreateCryptography();
        var wrapped = crypto.Wrap(Guid.NewGuid(), RandomNumberGenerator.GetBytes(32));

        Assert.ThrowsAny<CryptographicException>(() =>
            crypto.Unwrap(Guid.NewGuid(), wrapped));
    }

    [Fact]
    public void MissingOrIncorrectMasterKeyFailsClosed()
    {
        Assert.Throws<InvalidOperationException>(() =>
            new WorkspaceCryptography(new ConfigurationBuilder().Build()));

        Assert.Throws<InvalidOperationException>(() =>
            new WorkspaceCryptography(new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["WorkspaceEncryption:MasterKey"] = Convert.ToBase64String(new byte[16])
                })
                .Build()));
    }

    [Fact]
    public void RewrapPreservesDekAndExistingFieldCiphertext()
    {
        using var oldCrypto = new WorkspaceCryptography(
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)), "master-v1");
        using var newCrypto = new WorkspaceCryptography(
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)), "master-v2");
        var workspaceId = Guid.NewGuid();
        var recordId = Guid.NewGuid();
        var dek = RandomNumberGenerator.GetBytes(32);
        var wrapped = oldCrypto.Wrap(workspaceId, dek);
        var fieldCiphertext = oldCrypto.Protect(dek, workspaceId, "request", recordId,
            "Body", "secret before rotation");

        var rotated = WorkspaceKeyRewrap.Rewrap(workspaceId, "master-v1", wrapped,
            oldCrypto, newCrypto);
        var recovered = newCrypto.Unwrap(workspaceId, rotated);

        Assert.NotEqual(wrapped, rotated);
        Assert.Equal(dek, recovered);
        Assert.Equal("secret before rotation", newCrypto.Unprotect(recovered,
            workspaceId, "request", recordId, "Body", fieldCiphertext));
        Assert.ThrowsAny<CryptographicException>(() => oldCrypto.Unwrap(workspaceId, rotated));
        CryptographicOperations.ZeroMemory(dek);
        CryptographicOperations.ZeroMemory(recovered);
    }

    [Fact]
    public void RewrapRejectsWrongOldKeyIdOrAnotherWorkspace()
    {
        using var oldCrypto = new WorkspaceCryptography(
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)), "master-v1");
        using var newCrypto = new WorkspaceCryptography(
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)), "master-v2");
        var workspaceId = Guid.NewGuid();
        var wrapped = oldCrypto.Wrap(workspaceId, RandomNumberGenerator.GetBytes(32));

        Assert.ThrowsAny<CryptographicException>(() =>
            WorkspaceKeyRewrap.Rewrap(workspaceId, "unexpected", wrapped, oldCrypto, newCrypto));
        Assert.ThrowsAny<CryptographicException>(() =>
            WorkspaceKeyRewrap.Rewrap(Guid.NewGuid(), "master-v1", wrapped, oldCrypto, newCrypto));
    }

    [Fact]
    public void ExplicitMasterKeyIdentifierIsLoadedForNewWorkspaceKeys()
    {
        var crypto = new WorkspaceCryptography(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WorkspaceEncryption:MasterKey"] =
                    Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                ["WorkspaceEncryption:MasterKeyId"] = "master-v2"
            }).Build());

        Assert.Equal("master-v2", crypto.MasterKeyId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("../bad")]
    [InlineData("spaces are not allowed")]
    public void InvalidMasterKeyIdentifiersFailClosed(string masterKeyId)
    {
        Assert.Throws<InvalidOperationException>(() =>
            new WorkspaceCryptography(new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["WorkspaceEncryption:MasterKey"] =
                        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                    ["WorkspaceEncryption:MasterKeyId"] = masterKeyId
                }).Build()));
    }

    private static WorkspaceCryptography CreateCryptography() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WorkspaceEncryption:MasterKey"] =
                    Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            })
            .Build());
}
