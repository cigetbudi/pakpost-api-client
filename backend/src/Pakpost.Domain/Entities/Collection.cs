namespace Pakpost.Domain.Entities;

public sealed class Collection
{
    private Collection() { }
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    // Persisted defaults for the collection. Script changes never update this field.
    public string VariablesJson { get; private set; } = "[]";
    public int VariablesVersion { get; private set; }
    public void SetVariables(string json)
    {
        VariablesJson = json;
        VariablesVersion++;
    }
    public Guid CreatedByUserId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public void Rename(string name) { if(string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Collection name required"); Name = name.Trim(); }
    public Collection(Guid workspaceId, string name, Guid createdByUserId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Collection name required");
        Id = Guid.NewGuid(); WorkspaceId = workspaceId; Name = name.Trim();
        CreatedByUserId = createdByUserId; CreatedAt = DateTimeOffset.UtcNow;
    }
}
