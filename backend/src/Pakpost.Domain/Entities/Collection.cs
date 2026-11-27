namespace Pakpost.Domain.Entities;

public sealed class Collection
{
    private Collection()
    {
    }

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    // Organization metadata is separate from the collection's own requests and folders.
    public Guid? ParentCollectionId { get; private set; }
    public int SortOrder { get; private set; }
    public string VariablesJson { get; private set; } = "[]";
    public int VariablesVersion { get; private set; }
    public string? ScriptsJson { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public Collection(Guid workspaceId, string name, Guid createdByUserId)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Collection name required");
        }

        Id = Guid.NewGuid();
        WorkspaceId = workspaceId;
        Name = name.Trim();
        CreatedByUserId = createdByUserId;
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Collection name required");
        }

        Name = name.Trim();
    }

    public void Place(Guid? parentCollectionId, int sortOrder)
    {
        if (parentCollectionId == Id) throw new ArgumentException("Collection cannot parent itself");
        ParentCollectionId = parentCollectionId;
        SortOrder = sortOrder;
    }

    public void SetScripts(string json) => ScriptsJson = json;

    public void SetVariables(string json)
    {
        VariablesJson = json;
        VariablesVersion++;
    }
}
