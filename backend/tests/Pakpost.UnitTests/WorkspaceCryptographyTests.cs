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

    private static WorkspaceCryptography CreateCryptography() =>
        new(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WorkspaceEncryption:MasterKey"] =
                    Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            })
            .Build());
}
