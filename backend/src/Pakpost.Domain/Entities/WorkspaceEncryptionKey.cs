namespace Pakpost.Domain.Entities;

public sealed class WorkspaceEncryptionKey
{
    private WorkspaceEncryptionKey()
    {
    }

    public Guid WorkspaceId { get; private set; }
    public int KeyVersion { get; private set; }
    public string MasterKeyId { get; private set; } = string.Empty;
    public string WrappedKey { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    public WorkspaceEncryptionKey(Guid workspaceId, string wrappedKey, string masterKeyId = "master-v1")
    {
        WorkspaceId = workspaceId;
        KeyVersion = 1;
        MasterKeyId = masterKeyId;
        WrappedKey = wrappedKey;
        CreatedAt = DateTimeOffset.UtcNow;
    }
}
