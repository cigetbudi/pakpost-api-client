using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace Pakpost.Infrastructure.Services;

public sealed class WorkspaceCryptography : IDisposable
{
    public const string ContentPrefix = "w1:";

    private readonly byte[] _masterKey;
    public string MasterKeyId { get; }

    public WorkspaceCryptography(IConfiguration configuration)
        : this(configuration["WorkspaceEncryption:MasterKey"],
            configuration["WorkspaceEncryption:MasterKeyId"] ?? "master-v1")
    {
    }

    public WorkspaceCryptography(string? encoded, string masterKeyId)
    {
        MasterKeyId = masterKeyId;

        if (MasterKeyId.Length is < 1 or > 100 ||
            !System.Text.RegularExpressions.Regex.IsMatch(
                MasterKeyId, @"\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z"))
        {
            throw new InvalidOperationException(
                "WorkspaceEncryption__MasterKeyId must be a safe nonempty identifier (up to 100 chars)");
        }

        if (string.IsNullOrWhiteSpace(encoded))
        {
            throw new InvalidOperationException(
                "WorkspaceEncryption__MasterKey is required (Base64 of 32 random bytes)");
        }

        try
        {
            _masterKey = Convert.FromBase64String(encoded);
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException(
                "WorkspaceEncryption__MasterKey must be valid Base64", exception);
        }

        if (_masterKey.Length != 32)
        {
            throw new InvalidOperationException(
                "WorkspaceEncryption__MasterKey must decode to exactly 32 bytes");
        }
    }

    public string Wrap(Guid workspaceId, byte[] dek) =>
        Encrypt(_masterKey, dek, KeyContext(workspaceId), ContentPrefix);

    public byte[] Unwrap(Guid workspaceId, string wrappedKey) =>
        Decrypt(_masterKey, wrappedKey, KeyContext(workspaceId), ContentPrefix);

    public string Protect(
        byte[] dek,
        Guid workspaceId,
        string kind,
        Guid recordId,
        string field,
        string plaintext)
    {
        var bytes = Encoding.UTF8.GetBytes(plaintext);

        try
        {
            return Encrypt(dek, bytes, FieldContext(workspaceId, kind, recordId, field), ContentPrefix);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
        }
    }

    public string Unprotect(
        byte[] dek,
        Guid workspaceId,
        string kind,
        Guid recordId,
        string field,
        string ciphertext)
    {
        var bytes = Decrypt(dek, ciphertext, FieldContext(workspaceId, kind, recordId, field), ContentPrefix);

        try
        {
            return Encoding.UTF8.GetString(bytes);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
        }
    }

    public void Dispose() => CryptographicOperations.ZeroMemory(_masterKey);

    private static byte[] KeyContext(Guid workspaceId) =>
        Encoding.UTF8.GetBytes($"pakpost|workspace-dek|{workspaceId:D}|v1");

    private static byte[] FieldContext(
        Guid workspaceId,
        string kind,
        Guid recordId,
        string field) =>
        Encoding.UTF8.GetBytes($"pakpost|{workspaceId:D}|{kind}|{recordId:D}|{field}|v1");

    private static string Encrypt(byte[] key, byte[] plaintext, byte[] context, string prefix)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];

        using (var aes = new AesGcm(key, 16))
        {
            aes.Encrypt(nonce, plaintext, ciphertext, tag, context);
        }

        var result = new byte[nonce.Length + tag.Length + ciphertext.Length];
        nonce.CopyTo(result, 0);
        tag.CopyTo(result, nonce.Length);
        ciphertext.CopyTo(result, nonce.Length + tag.Length);

        return prefix + Convert.ToBase64String(result);
    }

    private static byte[] Decrypt(byte[] key, string value, byte[] context, string prefix)
    {
        if (!value.StartsWith(prefix, StringComparison.Ordinal))
        {
            throw new CryptographicException("Unknown workspace encryption format");
        }

        byte[] payload;

        try
        {
            payload = Convert.FromBase64String(value[prefix.Length..]);
        }
        catch (FormatException exception)
        {
            throw new CryptographicException("Invalid workspace ciphertext", exception);
        }

        if (payload.Length < 28)
        {
            throw new CryptographicException("Invalid workspace ciphertext length");
        }

        var clear = new byte[payload.Length - 28];

        using (var aes = new AesGcm(key, 16))
        {
            aes.Decrypt(
                payload.AsSpan(0, 12),
                payload.AsSpan(28),
                payload.AsSpan(12, 16),
                clear,
                context);
        }

        return clear;
    }
}
