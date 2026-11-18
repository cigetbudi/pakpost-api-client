namespace Pakpost.Domain.Entities;

public sealed class CollectionFolder
{
    private CollectionFolder()
    {
    }

    public Guid Id { get; private set; }
    public Guid CollectionId { get; private set; }
    public Guid? ParentFolderId { get; private set; }
    public string Name { get; private set; } = "";
    public int Version { get; private set; } = 1;
    public DateTimeOffset CreatedAt { get; private set; }

    public CollectionFolder(Guid collectionId, Guid? parentFolderId, string name)
    {
        Id = Guid.NewGuid();
        CollectionId = collectionId;
        ParentFolderId = parentFolderId;
        Name = ValidateName(name);
        CreatedAt = DateTimeOffset.UtcNow;
    }

    public void Rename(string name)
    {
        Name = ValidateName(name);
        Version++;
    }

    public void Move(Guid? parentFolderId)
    {
        ParentFolderId = parentFolderId;
        Version++;
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 120)
        {
            throw new ArgumentException("Folder name must be 1-120 characters");
        }

        return name.Trim();
    }
}
