namespace Pakpost.Domain.Entities;

public sealed class Workspace
{
    private Workspace() { }
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public Guid OwnerUserId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Workspace(string name, Guid ownerUserId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Workspace name required");
        Id = Guid.NewGuid(); Name = name.Trim(); OwnerUserId = ownerUserId;
        CreatedAt = DateTimeOffset.UtcNow;
    }
}
