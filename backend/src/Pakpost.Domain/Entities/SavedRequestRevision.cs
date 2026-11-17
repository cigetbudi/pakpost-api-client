namespace Pakpost.Domain.Entities;

// Immutable metadata plus an AES-GCM encrypted snapshot. Do not store request bodies,
// headers, auth settings, or scripts in plaintext history/audit records.
public sealed class SavedRequestRevision
{
    private SavedRequestRevision() { }
    public Guid Id { get; private set; }
    public Guid RequestId { get; private set; }
    public int Revision { get; private set; }
    public Guid ActorId { get; private set; }
    public string Action { get; private set; } = "updated";
    public string EncryptedSnapshot { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public SavedRequestRevision(Guid requestId,int revision,Guid actorId,string action,string encryptedSnapshot)
    {
        Id=Guid.NewGuid();RequestId=requestId;Revision=revision;ActorId=actorId;
        Action=action;EncryptedSnapshot=encryptedSnapshot;CreatedAt=DateTimeOffset.UtcNow;
    }
}
